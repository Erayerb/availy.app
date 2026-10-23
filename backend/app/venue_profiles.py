"""v2: the business's public profile on its venue page: cover photo, Instagram, phone and the ✓ badge.

Only the venue's own business account changes it; everyone sees it.
"""
import base64
import re
from datetime import datetime

import psycopg

MAX_PHOTO_BYTES = 600_000  # the app sends a small JPEG (about 100–300 KB)
PHOTO_PATTERN = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$")
INSTAGRAM_PATTERN = re.compile(r"^[A-Za-z0-9._]{1,30}$")


class ProfileError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def _own_venue(user: dict, venue_id: int) -> None:
    if user.get("role") != "business" or user.get("venue_id") != venue_id:
        raise ProfileError("Bu mekanın profilini yalnızca işletmesi düzenleyebilir.", 403)


def clean_instagram(raw: str) -> str | None:
    """"@kafe", "instagram.com/kafe/" or "kafe" -> "kafe"; empty -> None."""
    text = raw.strip()
    text = re.sub(r"^(https?://)?(www\.)?instagram\.com/", "", text).strip("/").lstrip("@")
    if not text:
        return None
    if not INSTAGRAM_PATTERN.match(text):
        raise ProfileError("Instagram kullanıcı adı geçersiz.")
    return text


def clean_phone(raw: str) -> str | None:
    text = " ".join(raw.split())
    if not text:
        return None
    digits = re.sub(r"\D", "", text)
    if not re.fullmatch(r"[+\d][\d ()-]*", text) or not 10 <= len(digits) <= 15:
        raise ProfileError("Telefon numarası geçersiz (ör. 0212 123 45 67).")
    return text


def save_links(conn: psycopg.Connection, user: dict, venue_id: int, instagram: str, phone: str, now: datetime) -> dict:
    _own_venue(user, venue_id)
    handle, number = clean_instagram(instagram), clean_phone(phone)
    conn.execute(
        """
        INSERT INTO venue_profiles (venue_id, instagram, phone, updated_at) VALUES (%s, %s, %s, %s)
        ON CONFLICT (venue_id) DO UPDATE SET instagram = EXCLUDED.instagram, phone = EXCLUDED.phone, updated_at = EXCLUDED.updated_at
        """,
        (venue_id, handle, number, now),
    )
    return {"instagram": handle, "phone": number}


def save_photo(conn: psycopg.Connection, user: dict, venue_id: int, data_uri: str, now: datetime) -> datetime:
    _own_venue(user, venue_id)
    match = PHOTO_PATTERN.match(data_uri.strip())
    if not match:
        raise ProfileError("Fotoğraf okunamadı (JPEG ya da PNG olmalı).")
    if len(base64.b64decode(match.group(2), validate=True)) > MAX_PHOTO_BYTES:
        raise ProfileError("Fotoğraf çok büyük; daha küçük bir fotoğraf seç.")
    conn.execute(
        """
        INSERT INTO venue_profiles (venue_id, photo, photo_at, updated_at) VALUES (%s, %s, %s, %s)
        ON CONFLICT (venue_id) DO UPDATE SET photo = EXCLUDED.photo, photo_at = EXCLUDED.photo_at, updated_at = EXCLUDED.updated_at
        """,
        (venue_id, data_uri.strip(), now, now),
    )
    return now


def load_photo(conn: psycopg.Connection, venue_id: int) -> tuple[str, bytes] | None:
    row = conn.execute("SELECT photo FROM venue_profiles WHERE venue_id = %s AND photo IS NOT NULL", (venue_id,)).fetchone()
    if row is None:
        return None
    match = PHOTO_PATTERN.match(row["photo"])
    return (match.group(1), base64.b64decode(match.group(2))) if match else None


def load_profiles(conn: psycopg.Connection, venue_ids: list[int]) -> dict[int, dict]:
    """For venue lists: photo time (the app loads the picture only when it changed), links and badge."""
    if not venue_ids:
        return {}
    rows = conn.execute(
        "SELECT venue_id, photo_at, instagram, phone, verified FROM venue_profiles WHERE venue_id = ANY(%s)", (venue_ids,)
    ).fetchall()
    return {r.pop("venue_id"): r for r in rows}


MAX_MOVE_M = 1000  # a correction, not a move to another place
MAX_TEXT = 120


def save_address(
    conn: psycopg.Connection,
    user: dict,
    venue_id: int,
    address: str,
    neighborhood: str,
    district: str,
    lat: float,
    lon: float,
) -> dict:
    """Address line, neighbourhood / district and the map point ("Yol tarifi" and check-ins use it)."""
    _own_venue(user, venue_id)
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ProfileError("Konum geçersiz.")
    if not district.strip():
        raise ProfileError("Semti yaz (ör. Kadıköy).")
    point = "ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography"
    moved = conn.execute(
        f"SELECT ST_Distance(location, {point}) AS m FROM venues WHERE id = %(id)s", {"lon": lon, "lat": lat, "id": venue_id}
    ).fetchone()
    if moved is None:
        raise ProfileError("Mekan bulunamadı.", 404)
    if moved["m"] > MAX_MOVE_M:
        raise ProfileError("Yeni nokta mekanın şimdiki yerine 1 km'den uzak; doğru adresi seçtiğinden emin ol.")
    return conn.execute(
        f"""
        UPDATE venues SET address = %(address)s, neighborhood = %(neighborhood)s, district = %(district)s,
                          location = {point}, edited_by_business = true
        WHERE id = %(id)s
        RETURNING address, neighborhood, district, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon
        """,
        {
            "address": " ".join(address.split())[:MAX_TEXT] or None,
            "neighborhood": " ".join(neighborhood.split())[:60],
            "district": " ".join(district.split())[:60],
            "lon": lon,
            "lat": lat,
            "id": venue_id,
        },
    ).fetchone()
