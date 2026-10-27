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


def save_user_photo(conn: psycopg.Connection, user: dict, data_uri: str, now: datetime) -> datetime:
    if user["is_guest"]:
        raise PhotoError("Profil fotoğrafı için kayıt ol.", 403)
    match = PHOTO_PATTERN.match(data_uri.strip())
    if not match:
        raise PhotoError("Fotoğraf okunamadı (JPEG ya da PNG olmalı).")
    if len(base64.b64decode(match.group(2), validate=True)) > MAX_PHOTO_BYTES:
        raise PhotoError("Fotoğraf çok büyük; daha küçük bir fotoğraf seç.")
    conn.execute(
        """
        INSERT INTO user_photos (user_id, photo, updated_at) VALUES (%s, %s, %s)
        ON CONFLICT (user_id) DO UPDATE SET photo = EXCLUDED.photo, updated_at = EXCLUDED.updated_at
        """,
        (user["id"], data_uri.strip(), now),
    )
    return now


def delete_user_photo(conn: psycopg.Connection, user: dict) -> None:
    conn.execute("DELETE FROM user_photos WHERE user_id = %s", (user["id"],))


def load_user_photo(conn: psycopg.Connection, username: str) -> tuple[str, bytes] | None:
    row = conn.execute(
        """
        SELECT p.photo FROM user_photos p JOIN users u ON u.id = p.user_id
        WHERE lower(u.username) = %s AND NOT u.frozen
        """,
        (normalize_username(username),),
    ).fetchone()
    if row is None:
        return None
    match = PHOTO_PATTERN.match(row["photo"])
    return (match.group(1), base64.b64decode(match.group(2))) if match else None


def photo_time(conn: psycopg.Connection, user_id: int) -> datetime | None:
    row = conn.execute("SELECT updated_at FROM user_photos WHERE user_id = %s", (user_id,)).fetchone()
    return row["updated_at"] if row else None
