"""Sign in with Google or Apple: the app sends the provider's ID token, we check it and open a session.

The token is a JWT signed by the provider; its keys are published (JWKS). We check the signature,
the issuer, that it was made for our app (audience), and that it has not expired. Nothing from the
provider is kept except its stable id for the person ("sub") and the e-mail.
"""
import re
import secrets
from dataclasses import dataclass

import jwt
import psycopg

from app.accounts import USER_COLUMNS, USERNAME_PATTERN, AccountError, normalize_email
from app.config import settings

PROVIDERS = {
    "google": {
        "jwks": "https://www.googleapis.com/oauth2/v3/certs",
        "issuers": ["https://accounts.google.com", "accounts.google.com"],
    },
    "apple": {"jwks": "https://appleid.apple.com/auth/keys", "issuers": ["https://appleid.apple.com"]},
}

_jwks_clients: dict[str, jwt.PyJWKClient] = {}


@dataclass
class Identity:
    provider: str
    subject: str
    email: str | None
    email_verified: bool


def audiences(provider: str) -> list[str]:
    """Our app's ids at the provider; empty means that sign-in is not set up yet."""
    return settings.google_client_ids if provider == "google" else settings.apple_audiences


def enabled_providers() -> list[str]:
    return [p for p in PROVIDERS if audiences(p)]


def verify_id_token(provider: str, token: str) -> Identity:
    """Check the provider's signed token; raises AccountError when it is not valid for us."""
    if provider not in PROVIDERS:
        raise AccountError("Bilinmeyen giriş yöntemi.")
    allowed = audiences(provider)
    if not allowed:
        raise AccountError("Bu giriş yöntemi henüz açık değil.", 503)
    info = PROVIDERS[provider]
    client = _jwks_clients.setdefault(provider, jwt.PyJWKClient(info["jwks"], cache_keys=True))
    try:
        key = client.get_signing_key_from_jwt(token)
        claims = jwt.decode(token, key.key, algorithms=["RS256"], audience=allowed, issuer=info["issuers"])
    except jwt.PyJWTError:
        raise AccountError("Giriş doğrulanamadı, tekrar dene.", 401) from None
    # Apple sends "true"/"false" as text, Google as a boolean
    verified = str(claims.get("email_verified", "false")).lower() == "true"
    email = claims.get("email")
    return Identity(provider, str(claims["sub"]), normalize_email(email) if email else None, verified)


def _free_username(conn: psycopg.Connection, email: str | None) -> str:
    """A user name from the e-mail ("ayse.k@…" → "ayse.k"), with a number when taken; changeable later."""
    base = re.sub(r"[^a-z0-9._]", "", (email or "").split("@")[0].lower()).strip("._")[:16]
    if len(base) < 3:
        base = "availo"
    candidate = base
    while not USERNAME_PATTERN.match(candidate) or conn.execute(
        "SELECT 1 FROM users WHERE lower(username) = %s", (candidate,)
    ).fetchone():
        candidate = f"{base}{secrets.randbelow(9000) + 1000}"
    return candidate


def sign_in_with(conn: psycopg.Connection, identity: Identity, name: str = "") -> tuple[dict, bool]:
    """The user for this outside account: known, linked by a verified e-mail, or new. Returns (user, created)."""
    row = conn.execute(
        f"SELECT {', '.join('u.' + c for c in USER_COLUMNS.split(', '))} FROM user_identities i "
        "JOIN users u ON u.id = i.user_id WHERE i.provider = %s AND i.subject = %s",
        (identity.provider, identity.subject),
    ).fetchone()
    created = False
    if row is None:
        if not identity.email:
            raise AccountError("Hesabından e-posta alınamadı; e-postayla kayıt olmayı dene.")
        # The provider vouches for the e-mail: the account already made with it is the same person
        row = conn.execute(f"SELECT {USER_COLUMNS} FROM users WHERE email = %s", (identity.email,)).fetchone()
        if row is not None and not identity.email_verified:
            raise AccountError("Bu e-posta zaten kayıtlı. E-posta ve şifrenle giriş yap.", 409)
        if row is None:
            username = _free_username(conn, identity.email)
            row = conn.execute(
                f"""
                INSERT INTO users (email, username, name, password_hash, role, email_verified)
                VALUES (%s, %s, %s, NULL, 'personal', %s)
                RETURNING {USER_COLUMNS}
                """,
                (identity.email, username, name.strip() or username, identity.email_verified),
            ).fetchone()
            created = True
        conn.execute(
            "INSERT INTO user_identities (provider, subject, user_id, email) VALUES (%s, %s, %s, %s)",
            (identity.provider, identity.subject, row["id"], identity.email),
        )
    if row["frozen"]:
        conn.execute("UPDATE users SET frozen = false WHERE id = %s", (row["id"],))
        row = {**row, "frozen": False}
    return row, created
