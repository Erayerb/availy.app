"""v2 check-ins: rules for a valid check-in (occupancy report + visit)."""
from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from app.config import settings
from app.hours import hours_for, local_hour

LEVELS = ("low", "medium", "high")
CHECKIN_RADIUS_M = 150
# Same person, same venue: once every 2 hours (stops one person inflating "4 kişi" and farming points)
VENUE_COOLDOWN = timedelta(hours=2)
# At most this many check-ins in any 60 minutes, across all venues
HOURLY_LIMIT = 10
HOURLY_WINDOW = timedelta(hours=1)

CHECKIN_COLUMNS = "id, venue_id, level, queue, seats, is_first, created_at"


@dataclass
class CheckinError(Exception):
    message: str
    status: int = 400


def validate_report(level: str, queue: bool | None, seats: bool | None) -> str | None:
    if level not in LEVELS:
        return "Doluluk Sakin, Orta ya da Kalabalık olmalı."
    if queue is not None and level != "high":
        return '"Sıra var mı?" yalnızca Kalabalık için sorulur.'
    if seats is not None and level != "medium":
        return '"Oturacak yer var mı?" yalnızca Orta için sorulur.'
    return None


def _clock(at: datetime) -> str:
    return at.astimezone(ZoneInfo(settings.dummy_timezone)).strftime("%H:%M")


def create_checkin(
    conn: psycopg.Connection,
    user: dict,
    venue_id: int,
    level: str,
    queue: bool | None,
    seats: bool | None,
    lat: float,
    lon: float,
    now: datetime,
) -> dict:
    problem = validate_report(level, queue, seats)
    if problem:
        raise CheckinError(problem)
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise CheckinError("Konum geçersiz.")

    venue = conn.execute(
        """
        SELECT category, always_busy,
               ST_Distance(location, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) AS distance_m
        FROM venues WHERE id = %s
        """,
        (lon, lat, venue_id),
    ).fetchone()
    if venue is None:
        raise CheckinError("Mekan bulunamadı.", 404)
    if not hours_for(venue["category"], venue["always_busy"]).is_open_at_hour(local_hour(now)):
        raise CheckinError("Mekan şu an kapalı.", 409)
    # The location is used only for this comparison and then dropped
    if venue["distance_m"] > CHECKIN_RADIUS_M:
        raise CheckinError(f"Check-in için mekana {CHECKIN_RADIUS_M} m'den yakın olmalısın.", 403)

    last = conn.execute(
        "SELECT max(created_at) AS at FROM checkins WHERE user_id = %s AND venue_id = %s",
        (user["id"], venue_id),
    ).fetchone()["at"]
    if last is not None and now - last < VENUE_COOLDOWN:
        raise CheckinError(
            f"Bu mekana 2 saatte bir check-in yapabilirsin. Tekrar: {_clock(last + VENUE_COOLDOWN)}", 429
        )
    recent = conn.execute(
        "SELECT count(*) AS n FROM checkins WHERE user_id = %s AND created_at > %s",
        (user["id"], now - HOURLY_WINDOW),
    ).fetchone()["n"]
    if recent >= HOURLY_LIMIT:
        raise CheckinError(f"Bir saatte en fazla {HOURLY_LIMIT} check-in yapabilirsin.", 429)

    insert = f"""
        INSERT INTO checkins (venue_id, user_id, level, queue, seats, is_first, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING {CHECKIN_COLUMNS}
    """
    first = conn.execute("SELECT NOT EXISTS (SELECT 1 FROM checkins WHERE venue_id = %s) AS f", (venue_id,)).fetchone()["f"]
    try:
        # Savepoint: if someone else became first at the same moment, retry as a normal check-in
        with conn.transaction():
            return conn.execute(insert, (venue_id, user["id"], level, queue, seats, first, now)).fetchone()
    except psycopg.errors.UniqueViolation:
        return conn.execute(insert, (venue_id, user["id"], level, queue, seats, False, now)).fetchone()


def load_crowds(conn: psycopg.Connection, venue_ids: list[int], now: datetime) -> dict[int, "Crowd"]:
    """Crowd of each venue from its check-ins of the last 90 minutes (unexplored when it has none at all)."""
    from app.crowd import WINDOW, Crowd, Report, crowd_from_checkins

    if not venue_ids:
        return {}
    last = {
        r["venue_id"]: r["at"]
        for r in conn.execute(
            "SELECT venue_id, max(created_at) AS at FROM checkins WHERE venue_id = ANY(%s) AND created_at <= %s GROUP BY venue_id",
            (venue_ids, now),
        ).fetchall()
    }
    reports: dict[int, list[Report]] = {}
    for r in conn.execute(
        """
        SELECT c.venue_id, c.user_id, c.level, c.queue, c.seats, c.created_at, COALESCE(u.trust, 1) AS trust
        FROM checkins c LEFT JOIN users u ON u.id = c.user_id
        WHERE c.venue_id = ANY(%s) AND c.created_at > %s AND c.created_at <= %s
        """,
        (venue_ids, now - WINDOW, now),
    ).fetchall():
        reports.setdefault(r["venue_id"], []).append(
            Report(r["user_id"], r["level"], r["queue"], r["seats"], r["created_at"], r["trust"])
        )
    return {vid: crowd_from_checkins(reports.get(vid, []), last.get(vid), now) for vid in venue_ids}
