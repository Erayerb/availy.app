"""v2 "Rehberden bul": find friends from the phone's contacts, only if the user asks for it.

The user may give their own phone number so others find them too (optional; only an HMAC of it is
stored: users.phone_hash). The app sends the numbers in the contacts; they are hashed the same way, compared with the
stored hashes and dropped: contacts are never stored. Only searchable personal accounts are found.
"""
import hashlib
import hmac
import re

import psycopg

from app.config import settings
from app.friends import relation
from app.safety import BLOCKED

MAX_CONTACTS = 2000


class ContactsError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def normalize_phone(raw: str) -> str | None:
    """"0532 123 45 67", "+90 532…", "532…" -> "+905321234567"; None when it is not a phone number."""
    digits = re.sub(r"\D", "", raw)
    if raw.strip().startswith("+"):
        number = "+" + digits
    elif digits.startswith("00"):
        number = "+" + digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        number = "+90" + digits[1:]
    elif len(digits) == 10 and digits.startswith("5"):
        number = "+90" + digits
    elif len(digits) == 12 and digits.startswith("90"):
        number = "+" + digits
    else:
        return None
    return number if 11 <= len(number) <= 16 else None


def phone_hash(number: str) -> str:
    return hmac.new(settings.phone_pepper.encode(), number.encode(), hashlib.sha256).hexdigest()


def set_phone(conn: psycopg.Connection, user: dict, raw: str) -> None:
    if user.get("is_guest") or user.get("role") != "personal":
        raise ContactsError("Rehberden bulmak için bireysel hesapla kayıt ol.", 403)
    number = normalize_phone(raw)
    if number is None:
        raise ContactsError("Telefon numarası geçersiz (ör. 0532 123 45 67).")
    conn.execute("UPDATE users SET phone_hash = %s WHERE id = %s", (phone_hash(number), user["id"]))


def remove_phone(conn: psycopg.Connection, user: dict) -> None:
    conn.execute("UPDATE users SET phone_hash = NULL WHERE id = %s", (user["id"],))


def match_contacts(conn: psycopg.Connection, user: dict, phones: list[str]) -> list[dict]:
    """availy users among the contacts, each with the number as it was sent (the app shows the rest with "Davet et")."""
    if user.get("is_guest") or user.get("role") != "personal":
        raise ContactsError("Rehberden bulmak için bireysel hesapla kayıt ol.", 403)
    sent: dict[str, str] = {}  # hash -> the number as the app sent it
    for raw in phones[:MAX_CONTACTS]:
        number = normalize_phone(raw)
        if number:
            sent.setdefault(phone_hash(number), raw)
    hashes = sorted(sent)
    if not hashes:
        return []
    rows = conn.execute(
        f"""
        SELECT id, username, name, phone_hash FROM users
        WHERE phone_hash = ANY(%(hashes)s) AND id <> %(me)s AND role = 'personal' AND NOT is_guest
          AND searchable AND username IS NOT NULL AND id NOT IN {BLOCKED}
        ORDER BY lower(username)
        """,
        {"hashes": hashes, "me": user["id"]},
    ).fetchall()
    return [
        {"id": r["id"], "username": r["username"], "name": r["name"], "phone": sent[r["phone_hash"]],
         "relation": relation(conn, user["id"], r["id"])}
        for r in rows
    ]
