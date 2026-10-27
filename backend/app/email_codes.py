"""v2: 6-digit e-mail codes for "Şifremi unuttum" (reset) and e-mail verification (verify).

Only a hash of the code is stored; a code works for 15 minutes and for 5 tries, and a new one
can be asked once a minute.
"""
import hashlib
import secrets
from datetime import datetime, timedelta

import psycopg

from app.accounts import (
    MAX_PASSWORD_LENGTH,
    MIN_PASSWORD_LENGTH,
    USER_COLUMNS,
    AccountError,
    hash_password,
    normalize_email,
)
from app.mailer import send_email

CODE_TTL = timedelta(minutes=15)
MAX_ATTEMPTS = 5
RESEND_AFTER = timedelta(minutes=1)

MESSAGES = {
    "reset": (
        "availy şifre sıfırlama kodun",
        "Şifreni sıfırlamak için kodun: {code}\n\nKod 15 dakika geçerli. Bunu sen istemediysen bu e-postayı yok say.",
    ),
    "verify": (
        "availy e-posta doğrulama kodun",
        "E-posta adresini doğrulamak için kodun: {code}\n\nKod 15 dakika geçerli.",
    ),
}

WRONG_CODE = "Kod hatalı ya da süresi dolmuş."


def _hash(user_id: int, code: str) -> str:
    return hashlib.sha256(f"{user_id}:{code}".encode()).hexdigest()


def send_code(conn: psycopg.Connection, user: dict, purpose: str, now: datetime) -> None:
    last = conn.execute(
        "SELECT created_at FROM email_codes WHERE user_id = %s AND purpose = %s", (user["id"], purpose)
    ).fetchone()
    if last and now - last["created_at"] < RESEND_AFTER:
        raise AccountError("Yeni kod için bir dakika bekle.", 429)
    code = f"{secrets.randbelow(1_000_000):06d}"
    conn.execute(
        """
        INSERT INTO email_codes (user_id, purpose, code_hash, attempts, created_at, expires_at)
        VALUES (%s, %s, %s, 0, %s, %s)
        ON CONFLICT (user_id, purpose) DO UPDATE
        SET code_hash = EXCLUDED.code_hash, attempts = 0, created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at
        """,
        (user["id"], purpose, _hash(user["id"], code), now, now + CODE_TTL),
    )
    subject, text = MESSAGES[purpose]
    send_email(user["email"], subject, text.format(code=code))


def _use_code(conn: psycopg.Connection, user_id: int, purpose: str, code: str, now: datetime) -> bool:
    row = conn.execute(
        "SELECT code_hash, attempts, expires_at FROM email_codes WHERE user_id = %s AND purpose = %s FOR UPDATE",
        (user_id, purpose),
    ).fetchone()
    if row is None or row["expires_at"] <= now or row["attempts"] >= MAX_ATTEMPTS:
        return False
    if not secrets.compare_digest(row["code_hash"], _hash(user_id, "".join(code.split()))):
        conn.execute(
            "UPDATE email_codes SET attempts = attempts + 1 WHERE user_id = %s AND purpose = %s", (user_id, purpose)
        )
        return False
    conn.execute("DELETE FROM email_codes WHERE user_id = %s AND purpose = %s", (user_id, purpose))
    return True


def request_reset(conn: psycopg.Connection, email: str, now: datetime) -> None:
    """Sends a code if an account has this e-mail; says nothing either way (who has an account stays private)."""
    user = conn.execute(
        "SELECT id, email FROM users WHERE email = %s AND password_hash IS NOT NULL", (normalize_email(email),)
    ).fetchone()
    if user is None:
        return
    try:
        send_code(conn, user, "reset", now)
    except AccountError:
        pass  # asked again within a minute: the earlier code still works


def reset_password(conn: psycopg.Connection, email: str, code: str, password: str, now: datetime) -> None:
    if not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
        raise AccountError(f"Şifre en az {MIN_PASSWORD_LENGTH} karakter olmalı.")
    user = conn.execute("SELECT id FROM users WHERE email = %s", (normalize_email(email),)).fetchone()
    if user is None or not _use_code(conn, user["id"], "reset", code, now):
        raise AccountError(WRONG_CODE)
    # The code came to this inbox, so the address is verified too; every old session signs out
    conn.execute(
        "UPDATE users SET password_hash = %s, email_verified = true, frozen = false,"
        " failed_logins = 0, password_locked = false WHERE id = %s",
        (hash_password(password), user["id"]),
    )
    conn.execute("DELETE FROM sessions WHERE user_id = %s", (user["id"],))


def request_verification(conn: psycopg.Connection, user: dict, now: datetime) -> None:
    if user.get("is_guest") or not user.get("email"):
        raise AccountError("Misafir hesabının e-postası yok. Önce kayıt ol.", 409)
    if user.get("email_verified"):
        raise AccountError("E-posta adresin zaten doğrulandı.", 409)
    send_code(conn, user, "verify", now)


def verify_email(conn: psycopg.Connection, user: dict, code: str, now: datetime) -> dict:
    if not _use_code(conn, user["id"], "verify", code, now):
        raise AccountError(WRONG_CODE)
    return conn.execute(
        f"UPDATE users SET email_verified = true WHERE id = %s RETURNING {USER_COLUMNS}", (user["id"],)
    ).fetchone()
