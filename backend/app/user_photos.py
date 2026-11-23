"""v2 profile photos: shown on the profile, in Sosyal (Akış, friends) instead of the first letter.

Anyone may load a person's photo by user name (an <Image> sends no sign-in); frozen accounts have none.
"""
import base64
from datetime import datetime

import psycopg

from app.accounts import normalize_username
from app.venue_profiles import MAX_PHOTO_BYTES, PHOTO_PATTERN


class PhotoError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


TABLES = ("user_photos", "user_covers")  # the profile photo, and the availo+ cover photo
FRAME_COLORS = ("gold", "red", "blue", "green", "purple", "pink", "orange", "teal", "indigo", "silver", "brown", "black")  # availo+: the frame round the photo


def _is_plus(conn: psycopg.Connection, user: dict) -> bool:
    return conn.execute("SELECT plan FROM users WHERE id = %s", (user["id"],)).fetchone()["plan"] == "premium"


def save_user_photo(conn: psycopg.Connection, user: dict, data_uri: str, now: datetime, table: str = "user_photos") -> datetime:
    assert table in TABLES
    if user["is_guest"]:
        raise PhotoError("Profil fotoğrafı için kayıt ol.", 403)
    if table == "user_covers" and not _is_plus(conn, user):
        raise PhotoError("Kapak fotoğrafı availo+ ile.", 402)
    match = PHOTO_PATTERN.match(data_uri.strip())
    if not match:
        raise PhotoError("Fotoğraf okunamadı (JPEG ya da PNG olmalı).")
    if len(base64.b64decode(match.group(2), validate=True)) > MAX_PHOTO_BYTES:
        raise PhotoError("Fotoğraf çok büyük; daha küçük bir fotoğraf seç.")
    conn.execute(
        f"""
        INSERT INTO {table} (user_id, photo, updated_at) VALUES (%s, %s, %s)
        ON CONFLICT (user_id) DO UPDATE SET photo = EXCLUDED.photo, updated_at = EXCLUDED.updated_at
        """,
        (user["id"], data_uri.strip(), now),
    )
    return now


def delete_user_photo(conn: psycopg.Connection, user: dict, table: str = "user_photos") -> None:
    assert table in TABLES
    conn.execute(f"DELETE FROM {table} WHERE user_id = %s", (user["id"],))


def load_user_photo(conn: psycopg.Connection, username: str, table: str = "user_photos") -> tuple[str, bytes] | None:
    assert table in TABLES
    row = conn.execute(
        f"""
        SELECT p.photo FROM {table} p JOIN users u ON u.id = p.user_id
        WHERE lower(u.username) = %s AND NOT u.frozen
          AND (%s = 'user_photos' OR u.plan = 'premium')  -- the cover goes when availo+ ends (kept, not shown)
        """,
        (normalize_username(username), table),
    ).fetchone()
    if row is None:
        return None
    match = PHOTO_PATTERN.match(row["photo"])
    return (match.group(1), base64.b64decode(match.group(2))) if match else None


def photo_time(conn: psycopg.Connection, user_id: int, table: str = "user_photos") -> datetime | None:
    assert table in TABLES
    row = conn.execute(f"SELECT updated_at FROM {table} WHERE user_id = %s", (user_id,)).fetchone()
    return row["updated_at"] if row else None


def set_frame(conn: psycopg.Connection, user: dict, color: str | None) -> None:
    """availo+: the colour of the frame round the profile photo (None: no frame)."""
    if color is not None and color not in FRAME_COLORS:
        raise PhotoError("Bu renk yok.")
    if color is not None and not _is_plus(conn, user):
        raise PhotoError("Renkli çerçeve availo+ ile.", 402)
    conn.execute("UPDATE users SET frame_color = %s WHERE id = %s", (color, user["id"]))
