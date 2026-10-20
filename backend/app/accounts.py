"""Server-side accounts (v2): users, password hashes and session tokens.

Passwords are hashed with scrypt from the standard library (no extra package);
session tokens are random and only their SHA-256 hash is stored.
"""
import hashlib
import hmac
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import cache

import psycopg

ROLES = ("personal", "business")
MIN_PASSWORD_LENGTH = 6  # same rule as the app
MAX_PASSWORD_LENGTH = 200
SESSION_DAYS = 30
# Guests have no password to sign in again, so their session lasts much longer
GUEST_SESSION_DAYS = 365
# A guest's check-ins count less until they sign up (abuse: guests are free to create)
GUEST_TRUST = 0.5
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# scrypt cost: n=2^14, r=8, p=1 (about 16 MB of memory per hash)
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1
SALT_BYTES = 16
KEY_BYTES = 32

# Same message for an unknown e-mail and a wrong password, so the API does not reveal who has an account
LOGIN_FAILED = "E-posta ya da şifre hatalı."


@dataclass
class AccountError(Exception):
    message: str
    status: int = 400


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_registration(name: str, email: str, password: str, role: str) -> str | None:
    if len(name.strip()) < 2:
        return "Adını gir."
    if not EMAIL_PATTERN.match(email.strip()):
        return "Geçerli bir e-posta gir."
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Şifre en az {MIN_PASSWORD_LENGTH} karakter olmalı."
    if len(password) > MAX_PASSWORD_LENGTH:
        return "Şifre çok uzun."
    if role not in ROLES:
        return "Hesap türü bireysel ya da işletme olmalı."
    return None


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt if salt is not None else secrets.token_bytes(SALT_BYTES)
    key = hashlib.scrypt(
        password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=KEY_BYTES
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${key.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, key = stored.split("$")
        if scheme != "scrypt":
            return False
        candidate = hashlib.scrypt(
            password.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p), dklen=len(key) // 2
        )
    except ValueError:
        return False
    return hmac.compare_digest(candidate.hex(), key)


@cache
def _dummy_hash() -> str:
    """Checked when the e-mail is unknown, so both failures take about the same time."""
    return hash_password(secrets.token_hex(8))


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


USER_COLUMNS = "id, email, name, role, venue_id, plan, trust, is_guest, created_at"


def create_user(conn: psycopg.Connection, name: str, email: str, password: str, role: str = "personal") -> dict:
    problem = validate_registration(name, email, password, role)
    if problem:
        raise AccountError(problem)
    user = conn.execute(
        f"""
        INSERT INTO users (email, name, password_hash, role)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (email) DO NOTHING
        RETURNING {USER_COLUMNS}
        """,
        (normalize_email(email), name.strip(), hash_password(password), role),
    ).fetchone()
    if user is None:
        raise AccountError("Bu e-posta zaten kayıtlı. Giriş yapmayı dene.", 409)
    return user


def create_guest(conn: psycopg.Connection) -> dict:
    """New guest account; the id comes from the database, the name is "Misafir <id>"."""
    user = conn.execute(
        f"""
        INSERT INTO users (name, is_guest, trust) VALUES ('Misafir', true, %s)
        RETURNING {USER_COLUMNS}
        """,
        (GUEST_TRUST,),
    ).fetchone()
    return conn.execute(
        f"UPDATE users SET name = %s WHERE id = %s RETURNING {USER_COLUMNS}",
        (f"Misafir {user['id']}", user["id"]),
    ).fetchone()


def upgrade_guest(conn: psycopg.Connection, user: dict, name: str, email: str, password: str, role: str = "personal") -> dict:
    """A guest signs up: same id (check-ins and points stay), now with e-mail and password."""
    if not user["is_guest"]:
        raise AccountError("Bu hesap zaten kayıtlı.", 409)
    problem = validate_registration(name, email, password, role)
    if problem:
        raise AccountError(problem)
    taken = conn.execute("SELECT 1 FROM users WHERE email = %s", (normalize_email(email),)).fetchone()
    if taken:
        raise AccountError("Bu e-posta zaten kayıtlı. Giriş yapmayı dene.", 409)
    return conn.execute(
        f"""
        UPDATE users
        SET name = %s, email = %s, password_hash = %s, role = %s, is_guest = false, trust = GREATEST(trust, 1)
        WHERE id = %s
        RETURNING {USER_COLUMNS}
        """,
        (name.strip(), normalize_email(email), hash_password(password), role, user["id"]),
    ).fetchone()


def authenticate(conn: psycopg.Connection, email: str, password: str, role: str | None = None) -> dict:
    row = conn.execute(
        f"SELECT {USER_COLUMNS}, password_hash FROM users WHERE email = %s",
        (normalize_email(email),),
    ).fetchone()
    if row is None:
        verify_password(password, _dummy_hash())
        raise AccountError(LOGIN_FAILED, 401)
    stored = row.pop("password_hash")
    if stored is None or not verify_password(password, stored):
        raise AccountError(LOGIN_FAILED, 401)
    if role is not None and row["role"] != role:
        raise AccountError(
            'Bu e-posta işletme hesabı olarak kayıtlı. Yukarıdan "İşletme"yi seç.'
            if row["role"] == "business"
            else 'Bu e-posta bireysel hesap olarak kayıtlı. Yukarıdan "Bireysel"i seç.',
            403,
        )
    return row


def create_session(
    conn: psycopg.Connection, user_id: int, now: datetime | None = None, days: int = SESSION_DAYS
) -> str:
    now = now or datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (%s, %s, %s, %s)",
        (hash_token(token), user_id, now, now + timedelta(days=days)),
    )
    return token


def user_for_token(conn: psycopg.Connection, token: str, now: datetime | None = None) -> dict | None:
    now = now or datetime.now(timezone.utc)
    return conn.execute(
        f"""
        SELECT {", ".join(f"u.{c}" for c in USER_COLUMNS.split(", "))}
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = %s AND s.expires_at > %s
        """,
        (hash_token(token), now),
    ).fetchone()


def delete_session(conn: psycopg.Connection, token: str) -> None:
    conn.execute("DELETE FROM sessions WHERE token_hash = %s", (hash_token(token),))
