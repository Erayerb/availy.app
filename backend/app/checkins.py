"""v2 check-ins: rules for a valid check-in (occupancy report + visit)."""
from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from app.config import settings
from app.hours import local_hour, venue_hours
from app.user_venues import maybe_approve

LEVELS = ("low", "medium", "high")
# TEMPORARY: 1 km so the app can be tried away from the venues; set back to 150 before the release
CHECKIN_RADIUS_M = 1000
# Same person, same venue: once every 2 hours (stops one person inflating "4 kişi" and farming points)
VENUE_COOLDOWN = timedelta(hours=2)
# At most this many check-ins in any 60 minutes, across all venues
HOURLY_LIMIT = 10
HOURLY_WINDOW = timedelta(hours=1)

CHECKIN_COLUMNS = "id, venue_id, level, queue, seats, is_first, created_at"

# availy points (for now): every check-in, plus a bonus for a venue's very first one
CHECKIN_POINTS = 10
FIRST_CHECKIN_POINTS = 50
# Guests get half of every award (they are free to create); what they earned stays when they sign up
GUEST_POINT_FACTOR = 0.5
# "Burayı X keşfetti" is shown on the venue for this long
DISCOVERY_SHOWN = timedelta(days=30)
# Trust: a report is compared with other people's reports at the same venue in the last 30 minutes.
# Far off (e.g. Kalabalık when others say Sakin) lowers the reporter's trust, close agreement raises it a little.
TRUST_WINDOW = timedelta(minutes=30)
TRUST_MIN_OTHERS = 2
TRUST_DISAGREE_GAP = 0.5  # Sakin (0.2) vs Kalabalık (0.9) is 0.7; Orta vs either side is 0.35
TRUST_AGREE_GAP = 0.2
TRUST_PENALTY = 0.1
TRUST_REWARD = 0.02
TRUST_FLOOR = 0.2

# Badge catalog: (id, name, icon, how to earn, stat it counts, target)
BADGES = [
    ("first_step", "İlk Adım", "👣", "İlk check-in'ini yap", "checkins", 1),
    ("explorer", "Kâşif", "✨", "Bir mekanın ilk check-in'ini yap", "discoveries", 1),
    ("great_explorer", "Büyük Kâşif", "🧭", "5 mekanın ilk check-in'ini yap", "discoveries", 5),
    ("traveller", "Gezgin", "🗺️", "5 farklı mekanda check-in yap", "venues", 5),
    ("regular", "Müdavim", "☕", "Aynı mekana 5 kez check-in yap", "max_same_venue", 5),
    ("night_owl", "Gece Kuşu", "🦉", "22:00'den sonra check-in yap", "night", 1),
    ("helper", "Yardımsever", "🤝", "25 check-in yap", "checkins", 25),
]


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
    private: bool = False,
) -> dict:
    # A business could make its own venue look empty: occupancy comes from customers only
    if user.get("role") == "business":
        raise CheckinError("İşletme hesapları check-in yapamaz.", 403)
    problem = validate_report(level, queue, seats)
    if problem:
        raise CheckinError(problem)
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise CheckinError("Konum geçersiz.")

    venue = conn.execute(
        """
        SELECT category, always_busy, open_hour, close_hour,
               ST_Distance(location, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) AS distance_m
        FROM venues WHERE id = %s
        """,
        (lon, lat, venue_id),
    ).fetchone()
    if venue is None:
        raise CheckinError("Mekan bulunamadı.", 404)
    if not venue_hours(venue).is_open_at_hour(local_hour(now)):
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
            f"Bu mekana 2 saatte bir check-in yapabilirsin.\nTekrar: {_clock(last + VENUE_COOLDOWN)}", 429
        )
    recent = conn.execute(
        "SELECT count(*) AS n FROM checkins WHERE user_id = %s AND created_at > %s",
        (user["id"], now - HOURLY_WINDOW),
    ).fetchone()["n"]
    if recent >= HOURLY_LIMIT:
        raise CheckinError(f"Bir saatte en fazla {HOURLY_LIMIT} check-in yapabilirsin.", 429)

    insert = f"""
        INSERT INTO checkins (venue_id, user_id, level, queue, seats, is_first, is_private, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, {'true' if private else 'false'}, %s)
        RETURNING {CHECKIN_COLUMNS}, is_private
    """
    first = conn.execute("SELECT NOT EXISTS (SELECT 1 FROM checkins WHERE venue_id = %s) AS f", (venue_id,)).fetchone()["f"]
    try:
        # Savepoint: if someone else became first at the same moment, retry as a normal check-in
        with conn.transaction():
            checkin = conn.execute(insert, (venue_id, user["id"], level, queue, seats, first, now)).fetchone()
    except psycopg.errors.UniqueViolation:
        checkin = conn.execute(insert, (venue_id, user["id"], level, queue, seats, False, now)).fetchone()
    update_trust(conn, user, venue_id, level, now)
    maybe_approve(conn, venue_id, now)
    visits = conn.execute(
        """
        SELECT
            (SELECT count(*) FROM checkins WHERE venue_id = %(v)s AND user_id = %(u)s) AS mine,
            (SELECT count(DISTINCT user_id) FROM checkins WHERE venue_id = %(v)s AND user_id IS NOT NULL) AS people
        """,
        {"v": venue_id, "u": user["id"]},
    ).fetchone()
    return {
        **checkin,
        "points_earned": award_points(conn, user, checkin, now),
        # "Burayı keşfeden 12. kişisin" on the first visit; later the visit count
        "visitor_rank": visits["people"] if visits["mine"] == 1 else None,
        "my_visits": visits["mine"],
    }


def update_trust(conn: psycopg.Connection, user: dict, venue_id: int, level: str, now: datetime) -> float | None:
    """Compare this report with others' and adjust the reporter's trust; returns the new value (None = unchanged)."""
    from app.accounts import GUEST_TRUST
    from app.crowd import LEVEL_SCORE

    others = conn.execute(
        """
        SELECT DISTINCT ON (user_id) level FROM checkins
        WHERE venue_id = %s AND user_id IS NOT NULL AND user_id <> %s AND created_at > %s AND created_at <= %s
        ORDER BY user_id, created_at DESC
        """,
        (venue_id, user["id"], now - TRUST_WINDOW, now),
    ).fetchall()
    if len(others) < TRUST_MIN_OTHERS:
        return None
    consensus = sum(LEVEL_SCORE[o["level"]] for o in others) / len(others)
    gap = abs(LEVEL_SCORE[level] - consensus)
    trust = conn.execute("SELECT trust FROM users WHERE id = %s", (user["id"],)).fetchone()["trust"]
    cap = GUEST_TRUST if user.get("is_guest") else 1.0
    if gap >= TRUST_DISAGREE_GAP:
        new = max(TRUST_FLOOR, trust - TRUST_PENALTY)
    elif gap <= TRUST_AGREE_GAP:
        new = min(cap, trust + TRUST_REWARD)
    else:
        return None
    new = round(new, 3)
    conn.execute("UPDATE users SET trust = %s WHERE id = %s", (new, user["id"]))
    return new


def award_points(conn: psycopg.Connection, user: dict, checkin: dict, now: datetime) -> int:
    factor = GUEST_POINT_FACTOR if user.get("is_guest") else 1
    awards = [(int(CHECKIN_POINTS * factor), "checkin")]
    if checkin["is_first"]:
        awards.append((int(FIRST_CHECKIN_POINTS * factor), "first_checkin"))
    user_id = user["id"]
    for amount, reason in awards:
        conn.execute(
            "INSERT INTO points (user_id, amount, reason, checkin_id, created_at) VALUES (%s, %s, %s, %s, %s)",
            (user_id, amount, reason, checkin["id"], now),
        )
    return sum(amount for amount, _ in awards)


def user_stats(conn: psycopg.Connection, user_id: int) -> dict:
    """Total points, check-in counts and the badge catalog (earned or not, with progress)."""
    row = conn.execute(
        f"""
        SELECT
            (SELECT COALESCE(sum(amount), 0) FROM points WHERE user_id = %(id)s) AS points,
            (SELECT count(*) FROM checkins WHERE user_id = %(id)s) AS checkins,
            (SELECT count(*) FROM checkins WHERE user_id = %(id)s AND is_first) AS discoveries,
            (SELECT count(DISTINCT venue_id) FROM checkins WHERE user_id = %(id)s) AS venues,
            (SELECT COALESCE(max(n), 0) FROM (
                SELECT count(*) AS n FROM checkins WHERE user_id = %(id)s GROUP BY venue_id) t) AS max_same_venue,
            (SELECT count(*) FROM checkins WHERE user_id = %(id)s
               AND extract(hour FROM created_at AT TIME ZONE '{settings.dummy_timezone}') NOT BETWEEN 5 AND 21) AS night
        """,
        {"id": user_id},
    ).fetchone()
    badges = [
        {
            "id": badge_id,
            "name": name,
            "icon": icon,
            "description": description,
            "progress": min(row[stat], target),
            "target": target,
            "earned": row[stat] >= target,
        }
        for badge_id, name, icon, description, stat, target in BADGES
    ]
    return {
        "points": row["points"],
        "checkins": row["checkins"],
        "discoveries": row["discoveries"],
        "badges": badges,
    }


def user_visits(conn: psycopg.Connection, user_id: int) -> list[dict]:
    """Venues this user checked in at ("Ziyaret ettiklerim"), most recent first."""
    return conn.execute(
        """
        SELECT venue_id, count(*) AS visits, max(created_at) AS last_at
        FROM checkins WHERE user_id = %s GROUP BY venue_id ORDER BY max(created_at) DESC
        """,
        (user_id,),
    ).fetchall()


def load_discoveries(conn: psycopg.Connection, venue_ids: list[int], now: datetime) -> dict[int, dict]:
    """Who checked in first at each venue, for the last 30 days ("Burayı X keşfetti")."""
    if not venue_ids:
        return {}
    rows = conn.execute(
        """
        SELECT c.venue_id, CASE WHEN c.is_private OR u.frozen THEN NULL ELSE u.name END AS name,
               CASE WHEN c.is_private OR u.frozen THEN NULL ELSE u.username END AS username, c.created_at AS at
        FROM checkins c LEFT JOIN users u ON u.id = c.user_id
        WHERE c.is_first AND NOT c.is_demo AND c.venue_id = ANY(%s) AND c.created_at > %s
        """,
        (venue_ids, now - DISCOVERY_SHOWN),
    ).fetchall()
    return {r["venue_id"]: {"name": r["name"], "username": r["username"], "at": r["at"]} for r in rows}


TREND_WINDOW = timedelta(hours=24)


def load_trends(conn: psycopg.Connection, venue_ids: list[int], now: datetime) -> dict[int, int]:
    """How many different people checked in at each venue in the last 24 hours ("Trendler")."""
    if not venue_ids:
        return {}
    rows = conn.execute(
        """
        SELECT venue_id, count(DISTINCT COALESCE(user_id, -id))::int AS people FROM checkins
        WHERE venue_id = ANY(%s) AND created_at > %s AND created_at <= %s
        GROUP BY venue_id
        """,
        (venue_ids, now - TREND_WINDOW, now),
    ).fetchall()
    return {r["venue_id"]: r["people"] for r in rows}


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
    crowds = {vid: crowd_from_checkins(reports.get(vid, []), last.get(vid), now) for vid in venue_ids}
    return _with_yesterday(conn, crowds, now)


def _with_yesterday(conn: psycopg.Connection, crowds: dict[int, "Crowd"], now: datetime) -> dict[int, "Crowd"]:
    """For venues without fresh check-ins: how full they were at this time yesterday ("Dün bu saatlerde")."""
    from dataclasses import replace

    from app.crowd import WINDOW, Report, crowd_from_checkins

    stale = [vid for vid, crowd in crowds.items() if crowd.state == "stale"]
    if not stale:
        return crowds
    then = now - timedelta(days=1)
    reports: dict[int, list[Report]] = {}
    for r in conn.execute(
        """
        SELECT c.venue_id, c.user_id, c.level, c.queue, c.seats, c.created_at, COALESCE(u.trust, 1) AS trust
        FROM checkins c LEFT JOIN users u ON u.id = c.user_id
        WHERE c.venue_id = ANY(%s) AND c.created_at > %s AND c.created_at <= %s
        """,
        (stale, then - WINDOW, then),
    ).fetchall():
        reports.setdefault(r["venue_id"], []).append(
            Report(r["user_id"], r["level"], r["queue"], r["seats"], r["created_at"], r["trust"])
        )
    for vid, rows in reports.items():
        past = crowd_from_checkins(rows, max(x.created_at for x in rows), then)
        if past.state == "live":
            crowds[vid] = replace(crowds[vid], yesterday_level=past.level)
    return crowds
