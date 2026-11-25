"""v2: coming back. "🔥 5 gün üst üste" (days in a row with a check-in) and a venue's regular
("müdavim": the one with the most check-ins there lately, among the people I may see as one).
"""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg


ISTANBUL = ZoneInfo("Europe/Istanbul")
REGULAR_DAYS = 30  # check-ins this recent count
REGULAR_MIN_VISITS = 3  # as in the business statistics (Müdavim, 3+ kez)


def _week_start(at: datetime) -> datetime:
    """Monday 00:00 (Istanbul) of the week `at` is in."""
    local = at.astimezone(ISTANBUL)
    return (local - timedelta(days=local.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)


def istanbul_day(at: datetime) -> date:
    return at.astimezone(ISTANBUL).date()


def day_streak(conn: psycopg.Connection, user_id: int, now: datetime) -> int:
    """Days in a row (Istanbul) with at least one check-in, up to today. Today may still be empty: the streak
    lasts until a day ends without a check-in. A day a friend saved ("Seri kurtarma") counts too."""
    days = {
        istanbul_day(r["created_at"])
        for r in conn.execute(
            "SELECT created_at FROM checkins WHERE user_id = %s AND NOT is_demo AND created_at <= %s AND created_at > %s",
            (user_id, now, now - timedelta(days=400)),
        )
    }
    days |= {r["day"] for r in conn.execute("SELECT day FROM streak_saves WHERE user_id = %s", (user_id,))}
    day = istanbul_day(now)
    if day not in days:
        day -= timedelta(days=1)
    streak = 0
    while day in days:
        streak += 1
        day -= timedelta(days=1)
    return streak


def top_regular(conn: psycopg.Connection, venue_id: int, now: datetime) -> dict | None:
    """"Buranın müdavimi", the same for everyone: the most public check-ins here in the last 30 days (at least 3);
    on a tie, the one who was here last. Private check-ins do not count."""
    return conn.execute(
        """
        SELECT u.id, u.username, u.regular_public, count(*)::int AS visits
        FROM checkins c JOIN users u ON u.id = c.user_id
        WHERE c.venue_id = %(venue)s AND NOT c.is_private AND NOT c.is_demo AND c.created_at > %(since)s
          AND c.created_at <= %(now)s AND NOT u.frozen AND NOT u.is_guest AND u.username IS NOT NULL
        GROUP BY u.id, u.username, u.regular_public
        HAVING count(*) >= %(min)s
        ORDER BY count(*) DESC, max(c.created_at) DESC
        LIMIT 1
        """,
        {"venue": venue_id, "since": now - timedelta(days=REGULAR_DAYS), "now": now, "min": REGULAR_MIN_VISITS},
    ).fetchone()


def update_regular(conn: psycopg.Connection, venue_id: int, now: datetime) -> None:
    """After a check-in: who the regular is now. Someone new took the place: the one before is told
    ("Mado'daki müdavimliğini @ayse aldı"); an event, not a timetable."""
    top = top_regular(conn, venue_id, now)
    before = conn.execute("SELECT user_id FROM venue_regulars WHERE venue_id = %s", (venue_id,)).fetchone()
    if top is None:
        return  # nobody has enough check-ins (yet): the last one keeps the place until someone takes it
    if before and before["user_id"] == top["id"]:
        return
    conn.execute(
        """
        INSERT INTO venue_regulars (venue_id, user_id, since) VALUES (%s, %s, %s)
        ON CONFLICT (venue_id) DO UPDATE SET user_id = EXCLUDED.user_id, since = EXCLUDED.since
        """,
        (venue_id, top["id"], now),
    )
    if before:
        conn.execute(
            "INSERT INTO regular_changes (venue_id, lost_by, taken_by, created_at) VALUES (%s, %s, %s, %s)",
            (venue_id, before["user_id"], top["id"], now),
        )


def regular_count(conn: psycopg.Connection, user_id: int) -> int:
    """The venues where this person is the regular (the 🏠 on the profile)."""
    return conn.execute("SELECT count(*)::int AS n FROM venue_regulars WHERE user_id = %s", (user_id,)).fetchone()["n"]


def venue_regular(conn: psycopg.Connection, me: dict, venue_id: int, now: datetime) -> dict | None:
    """The venue's regular for the page. Who keeps it to friends ("Müdavimliğim herkese açık" off) is still the
    regular, but others read "Gizli müdavim" (no name)."""
    top = top_regular(conn, venue_id, now)
    if top is None:
        return None
    is_me = top["id"] == me["id"]
    friend = not is_me and conn.execute(
        """
        SELECT 1 FROM friendships WHERE status = 'accepted'
          AND ((requester_id = %(me)s AND addressee_id = %(other)s) OR (requester_id = %(other)s AND addressee_id = %(me)s))
          AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id = %(me)s AND blocked_id = %(other)s) OR (blocker_id = %(other)s AND blocked_id = %(me)s))
        """,
        {"me": me["id"], "other": top["id"]},
    ).fetchone() is not None
    blocked = not is_me and conn.execute(
        "SELECT 1 FROM blocks WHERE (blocker_id = %(me)s AND blocked_id = %(o)s) OR (blocker_id = %(o)s AND blocked_id = %(me)s)",
        {"me": me["id"], "o": top["id"]},
    ).fetchone() is not None
    shown = is_me or friend or (top["regular_public"] and not blocked)
    return {"username": top["username"] if shown else None, "visits": top["visits"], "me": is_me, "friend": friend}
