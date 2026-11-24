"""v2: coming back. "🔥 5 gün üst üste" (days in a row with a check-in) and a venue's regular
("müdavim": the one with the most check-ins there lately, among the people I may see as one).
"""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from app.safety import BLOCKED

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


def venue_regular(conn: psycopg.Connection, me: dict, venue_id: int, now: datetime) -> dict | None:
    """"Buranın müdavimi": most public check-ins here in the last 30 days (at least 3), among me,
    my friends (who share their check-ins) and people who show it to everyone (regular_public);
    on a tie, the one who was here last."""
    row = conn.execute(
        f"""
        WITH friends AS (
            SELECT addressee_id AS id FROM friendships WHERE requester_id = %(me)s AND status = 'accepted'
            UNION SELECT requester_id FROM friendships WHERE addressee_id = %(me)s AND status = 'accepted'
        )
        SELECT u.username, count(*)::int AS visits, u.id = %(me)s AS me, u.id IN (SELECT id FROM friends) AS friend
        FROM checkins c JOIN users u ON u.id = c.user_id
        WHERE c.venue_id = %(venue)s AND NOT c.is_private AND NOT c.is_demo AND c.created_at > %(since)s
          AND NOT u.frozen AND NOT u.is_guest AND u.username IS NOT NULL
          AND (u.id = %(me)s OR (u.id NOT IN {BLOCKED} AND (
                (u.share_checkins AND u.id IN (SELECT id FROM friends)) OR u.regular_public)))
        GROUP BY u.id, u.username
        HAVING count(*) >= %(min)s
        ORDER BY count(*) DESC, max(c.created_at) DESC
        LIMIT 1
        """,
        {"venue": venue_id, "me": me["id"], "since": now - timedelta(days=REGULAR_DAYS), "min": REGULAR_MIN_VISITS},
    ).fetchone()
    return dict(row) if row else None
