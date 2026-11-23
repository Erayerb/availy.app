"""availo+ "Aylık özet": a month of check-ins, the venues and districts most gone to, and how it compares
with last month and with friends. This month so far, or a past month."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from app.config import settings

ISTANBUL = ZoneInfo(settings.dummy_timezone)


class SummaryError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def month_bounds(now: datetime, months_back: int = 0) -> tuple[datetime, datetime]:
    """Start and end of a month in Istanbul (0: this month, 1: last month...)."""
    local = now.astimezone(ISTANBUL)
    year, month = local.year, local.month - months_back
    while month < 1:
        year, month = year - 1, month + 12
    start = datetime(year, month, 1, tzinfo=ISTANBUL)
    end = datetime(year + (month == 12), month % 12 + 1, 1, tzinfo=ISTANBUL)
    return start, end


def months_since(start: datetime, now: datetime, cap: int = 12) -> int:
    """How many months to offer in the month picker: this one back to the month the person (or business)
    started, at most `cap`."""
    a, b = start.astimezone(ISTANBUL), now.astimezone(ISTANBUL)
    return max(1, min(cap, (b.year - a.year) * 12 + b.month - a.month + 1))


def _counts(conn: psycopg.Connection, user_ids: list[int], start: datetime, end: datetime) -> dict[int, int]:
    rows = conn.execute(
        """
        SELECT user_id, count(*)::int AS n FROM checkins
        WHERE user_id = ANY(%s) AND created_at >= %s AND created_at < %s GROUP BY user_id
        """,
        (user_ids, start, end),
    ).fetchall()
    return {r["user_id"]: r["n"] for r in rows}


def monthly_summary(conn: psycopg.Connection, me: dict, now: datetime, months_back: int = 0) -> dict:
    plan = conn.execute("SELECT plan FROM users WHERE id = %s", (me["id"],)).fetchone()["plan"]
    if plan != "premium":
        raise SummaryError("Aylık özet availo+ ile.", 402)
    if not 0 <= months_back <= 11:
        raise SummaryError("En fazla 12 ay geriye bakılabilir.")
    start, end = month_bounds(now, months_back)
    end = min(end, now + timedelta(seconds=1))  # this month: up to now, the check-in just made included
    previous_start, previous_end = month_bounds(now, months_back + 1)
    params = {"me": me["id"], "start": start, "end": end}
    top_venues = conn.execute(
        """
        SELECT v.id, v.name, v.district, count(*)::int AS visits
        FROM checkins c JOIN venues v ON v.id = c.venue_id
        WHERE c.user_id = %(me)s AND c.created_at >= %(start)s AND c.created_at < %(end)s
        GROUP BY v.id ORDER BY visits DESC, max(c.created_at) DESC LIMIT 5
        """,
        params,
    ).fetchall()
    districts = conn.execute(
        """
        SELECT v.district, count(*)::int AS visits
        FROM checkins c JOIN venues v ON v.id = c.venue_id
        WHERE c.user_id = %(me)s AND c.created_at >= %(start)s AND c.created_at < %(end)s AND v.district IS NOT NULL
        GROUP BY v.district ORDER BY visits DESC LIMIT 3
        """,
        params,
    ).fetchall()
    totals = conn.execute(
        """
        SELECT count(*)::int AS checkins, count(DISTINCT venue_id)::int AS venues,
               count(*) FILTER (WHERE is_first)::int AS discoveries,
               (SELECT COALESCE(sum(amount), 0)::int FROM points
                WHERE user_id = %(me)s AND created_at >= %(start)s AND created_at < %(end)s) AS points
        FROM checkins WHERE user_id = %(me)s AND created_at >= %(start)s AND created_at < %(end)s
        """,
        params,
    ).fetchone()
    previous = _counts(conn, [me["id"]], previous_start, previous_end).get(me["id"], 0)
    friends = [
        r["id"]
        for r in conn.execute(
            """
            SELECT CASE WHEN requester_id = %(me)s THEN addressee_id ELSE requester_id END AS id
            FROM friendships WHERE status = 'accepted' AND %(me)s IN (requester_id, addressee_id)
            """,
            params,
        ).fetchall()
    ]
    counts = _counts(conn, friends, start, end)
    ranked = sorted([totals["checkins"], *(counts.get(f, 0) for f in friends)], reverse=True)
    created = conn.execute("SELECT created_at FROM users WHERE id = %s", (me["id"],)).fetchone()["created_at"]
    return {
        "months_available": months_since(created, now),
        "month": start.strftime("%Y-%m"),
        **totals,
        "previous_checkins": previous,
        "top_venues": top_venues,
        "top_districts": districts,
        "friends": len(friends),
        # Among me and my friends, by check-ins (1 = most); friends' average for comparison
        "rank_among_friends": ranked.index(totals["checkins"]) + 1 if friends else None,
        "friends_average": round(sum(counts.values()) / len(friends), 1) if friends else None,
    }
