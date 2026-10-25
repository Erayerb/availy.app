"""v2 "Mekan ekle": a user adds a missing venue (they have to be near the spot), or a business adds its own.

The venue waits for approval ("⏳ Onay bekliyor") and still takes check-ins. When three other people
have checked in there on at least three different days, it is approved and whoever added it gets
points. Unapproved venues are hidden after 30 days (app/venues.py VISIBLE).
"""
from datetime import datetime, timedelta

import psycopg

from app.venues import fold_tr

MAX_NAME = 60
CATEGORIES = {
    # category: purpose tags (the same as the OpenStreetMap import)
    "cafe": ["socializing"],
    "restaurant": ["food", "socializing"],
    "bar": ["entertainment", "nightlife", "socializing"],
    "library": ["coworking", "quiet"],
    "coworking": ["coworking", "quiet"],
}
DEFAULT_CAPACITY = 50
SAME_PLACE_M = 60  # a venue with the same name this close is probably the same one
CROWDED_M = 25  # another venue this close: its dot would hide the new one, so ask first
NEAR_WARNING = "Yine de ekle"  # the app shows this button for the warning below
MAX_PENDING = 3  # venues one person may have waiting for approval
APPROVE_PEOPLE = 3
APPROVE_DAYS = 3
APPROVAL_POINTS = 50


class VenueError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def add_venue(
    conn: psycopg.Connection,
    user: dict,
    name: str,
    category: str,
    lat: float,
    lon: float,
    neighborhood: str,
    district: str,
    now: datetime,
    address: str = "",
    user_lat: float | None = None,
    user_lon: float | None = None,
    confirm_near: bool = False,
) -> dict:
    """`lat`/`lon`: the venue's point (from the map or the phone); `user_lat`/`user_lon`: where the user is.
    A customer has to be near the venue; a business adds its own venue from anywhere and gets it."""
    business = user.get("role") == "business"
    if user.get("is_guest"):
        raise VenueError("Mekan eklemek için kayıt ol.", 403)
    if business and user.get("venue_id"):
        raise VenueError("İşletme hesabının zaten bir mekanı var.", 409)
    text = " ".join(name.split())
    if not 2 <= len(text) <= MAX_NAME:
        raise VenueError(f"Mekanın adını yaz (en fazla {MAX_NAME} karakter).")
    if category not in CATEGORIES:
        raise VenueError("Mekan türünü seç.")
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise VenueError("Konum geçersiz.")
    waiting = conn.execute(
        "SELECT count(*)::int AS n FROM venues WHERE added_by = %s AND approved_at IS NULL AND created_at > %s",
        (user["id"], now - timedelta(days=30)),
    ).fetchone()["n"]
    if waiting >= MAX_PENDING:
        raise VenueError(f"Onay bekleyen {MAX_PENDING} mekanın var; onaylanınca yenisini ekleyebilirsin.", 429)
    point = "ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography"
    if not business:
        from app.checkins import CHECKIN_RADIUS_M  # app.checkins imports this module

        if user_lat is None or user_lon is None:
            raise VenueError("Mekan eklemek için konumun gerekli.")
        away = conn.execute(
            f"SELECT ST_Distance({point}, ST_SetSRID(ST_MakePoint(%(ulon)s, %(ulat)s), 4326)::geography) AS m",
            {"lon": lon, "lat": lat, "ulon": user_lon, "ulat": user_lat},
        ).fetchone()["m"]
        if away > CHECKIN_RADIUS_M:
            raise VenueError(f"Mekan eklemek için seçtiğin noktaya {CHECKIN_RADIUS_M} m'den yakın olmalısın.", 403)
    for near in conn.execute(
        f"SELECT name FROM venues WHERE source <> 'demo' AND ST_DWithin(location, {point}, %(m)s)",
        {"lon": lon, "lat": lat, "m": SAME_PLACE_M},
    ).fetchall():
        a, b = fold_tr(near["name"]), fold_tr(text)
        if a == b or a in b or b in a:
            raise VenueError(f"Burada zaten \"{near['name']}\" var. Listede ara ve ona check-in yap.", 409)
    if not confirm_near:
        close = conn.execute(
            f"""
            SELECT name, round(ST_Distance(location, {point}))::int AS m FROM venues
            WHERE source <> 'demo' AND ST_DWithin(location, {point}, %(m)s) ORDER BY 2 LIMIT 1
            """,
            {"lon": lon, "lat": lat, "m": CROWDED_M},
        ).fetchone()
        if close:
            raise VenueError(
                f"Seçtiğin noktanın {close['m']} m yakınında \"{close['name']}\" var; haritada üst üste görünürler. "
                f"Aynı mekan değilse \"{NEAR_WARNING}\".",
                409,
            )
    row = conn.execute(
        f"""
        INSERT INTO venues (name, category, location, capacity, neighborhood, district, address, tags, source, added_by,
                            created_at)
        VALUES (%(name)s, %(category)s, {point}, %(capacity)s, %(neighborhood)s, %(district)s, %(address)s, %(tags)s,
                'user', %(user)s, %(now)s)
        RETURNING id
        """,
        {
            "name": text,
            "category": category,
            "lon": lon,
            "lat": lat,
            "capacity": DEFAULT_CAPACITY,
            "neighborhood": neighborhood.strip()[:60],
            "district": district.strip()[:60],
            "address": " ".join(address.split())[:120] or None,
            "tags": CATEGORIES[category],
            "user": user["id"],
            "now": now,
        },
    ).fetchone()
    if business:
        conn.execute("UPDATE users SET venue_id = %s WHERE id = %s", (row["id"], user["id"]))
    return {"id": row["id"], "name": text}


def maybe_approve(conn: psycopg.Connection, venue_id: int, now: datetime) -> bool:
    """After a check-in: approve a waiting venue once enough other people have been there."""
    venue = conn.execute(
        "SELECT added_by FROM venues WHERE id = %s AND source = 'user' AND approved_at IS NULL", (venue_id,)
    ).fetchone()
    if venue is None:
        return False
    seen = conn.execute(
        """
        SELECT count(DISTINCT user_id)::int AS people,
               count(DISTINCT (created_at AT TIME ZONE 'Europe/Istanbul')::date)::int AS days
        FROM checkins
        WHERE venue_id = %s AND user_id IS NOT NULL AND user_id IS DISTINCT FROM %s AND NOT is_demo
        """,
        (venue_id, venue["added_by"]),
    ).fetchone()
    if seen["people"] < APPROVE_PEOPLE or seen["days"] < APPROVE_DAYS:
        return False
    conn.execute("UPDATE venues SET approved_at = %s WHERE id = %s", (now, venue_id))
    if venue["added_by"] is not None:
        conn.execute(
            "INSERT INTO points (user_id, amount, reason, created_at) VALUES (%s, %s, 'venue_added', %s)",
            (venue["added_by"], APPROVAL_POINTS, now),
        )
    return True
