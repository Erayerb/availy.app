"""v2: coming back. "🔥 4 haftalık seri" (weeks in a row with a check-in) and the friends' regular
of a venue ("👑 müdavim": among me and my friends, the one with the most check-ins there lately).
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from app.safety import BLOCKED

ISTANBUL = ZoneInfo("Europe/Istanbul")
REGULAR_DAYS = 30  # check-ins this recent count for the crown
REGULAR_MIN_VISITS = 2  # one visit does not make a regular


def _week_start(at: datetime) -> datetime:
    """Monday 00:00 (Istanbul) of the week `at` is in."""
    local = at.astimezone(ISTANBUL)
    return (local - timedelta(days=local.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)


def weekly_streak(conn: psycopg.Connection, user_id: int, now: datetime) -> int:
    """Weeks in a row (Monday to Sunday) with at least one check-in, up to this week.
    This week may still be empty: the streak lasts until the week ends without a check-in."""
    weeks = {
        _week_start(r["created_at"])
        for r in conn.execute(
            "SELECT created_at FROM checkins WHERE user_id = %s AND NOT is_demo AND created_at <= %s AND created_at > %s",
            (user_id, now, now - timedelta(weeks=104)),
        )
    }
    week = _week_start(now)
    if week not in weeks:
        week -= timedelta(weeks=1)
    streak = 0
    while week in weeks:
        streak += 1
        week = _week_start(week - timedelta(days=3))
    return streak


def friends_regular(conn: psycopg.Connection, me: dict, venue_id: int, now: datetime) -> dict | None:
    """"👑 Arkadaşların arasında buranın müdavimi": me or a friend, most public check-ins here in the
    last 30 days (at least 2); on a tie, the one who was here last."""
    row = conn.execute(
        f"""
        SELECT u.username, count(*)::int AS visits, u.id = %(me)s AS me
        FROM checkins c JOIN users u ON u.id = c.user_id
        WHERE c.venue_id = %(venue)s AND NOT c.is_private AND NOT c.is_demo AND c.created_at > %(since)s
          AND NOT u.frozen AND u.username IS NOT NULL
          AND (u.id = %(me)s OR (u.share_checkins AND u.id NOT IN {BLOCKED} AND u.id IN (
                SELECT addressee_id FROM friendships WHERE requester_id = %(me)s AND status = 'accepted'
                UNION SELECT requester_id FROM friendships WHERE addressee_id = %(me)s AND status = 'accepted')))
        GROUP BY u.id, u.username
        HAVING count(*) >= %(min)s
        ORDER BY count(*) DESC, max(c.created_at) DESC
        LIMIT 1
        """,
        {"venue": venue_id, "me": me["id"], "since": now - timedelta(days=REGULAR_DAYS), "min": REGULAR_MIN_VISITS},
    ).fetchone()
    return dict(row) if row else None
