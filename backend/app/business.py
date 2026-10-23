"""v2 business panel: the business's venue on the server and its check-in statistics.

Everything comes from customers' check-ins (no estimated occupancy any more).
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from app.crowd import report_score, Report

ISTANBUL = ZoneInfo("Europe/Istanbul")


class BusinessError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def set_business_venue(conn: psycopg.Connection, user: dict, venue_id: int) -> dict:
    if user.get("role") != "business":
        raise BusinessError("Yalnızca işletme hesapları mekan seçebilir.", 403)
    if conn.execute("SELECT 1 FROM venues WHERE id = %s", (venue_id,)).fetchone() is None:
        raise BusinessError("Mekan bulunamadı.", 404)
    return conn.execute("UPDATE users SET venue_id = %s WHERE id = %s RETURNING venue_id", (venue_id, user["id"])).fetchone()


def _level_of(score: float) -> str:
    from app.occupancy import classify

    return classify(score).value


def venue_stats(conn: psycopg.Connection, user: dict, venue_id: int, now: datetime) -> dict:
    """Today by hour, the last 7 days (people, new / returning) and the last 30 days by weekday."""
    if user.get("role") != "business" or user.get("venue_id") != venue_id:
        raise BusinessError("Bu mekanın istatistikleri yalnızca işletmesine açık.", 403)
    local = now.astimezone(ISTANBUL)
    day_start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    rows = conn.execute(
        """
        SELECT user_id, level, queue, seats, created_at FROM checkins
        WHERE venue_id = %s AND created_at > %s AND created_at <= %s
        """,
        (venue_id, now - timedelta(days=30), now),
    ).fetchall()

    # Today, by hour: how many check-ins and how full they said it was
    hours: dict[int, list[float]] = {}
    for r in rows:
        at = r["created_at"].astimezone(ISTANBUL)
        if at >= day_start:
            score = report_score(Report(r["user_id"], r["level"], r["queue"], r["seats"], r["created_at"]))
            hours.setdefault(at.hour, []).append(score)
    today = [
        {"hour": h, "checkins": len(hours.get(h, [])), "level": _level_of(sum(hours[h]) / len(hours[h])) if h in hours else None}
        for h in range(24)
    ]

    # Last 30 days by weekday (Monday = 0)
    weekday = [0] * 7
    for r in rows:
        weekday[r["created_at"].astimezone(ISTANBUL).weekday()] += 1

    # Last 7 days: people, and whether they were here before
    week_ago = now - timedelta(days=7)
    week_people = {r["user_id"] for r in rows if r["created_at"] > week_ago and r["user_id"] is not None}
    returning = 0
    if week_people:
        returning = conn.execute(
            "SELECT count(DISTINCT user_id)::int AS n FROM checkins WHERE venue_id = %s AND user_id = ANY(%s) AND created_at <= %s",
            (venue_id, list(week_people), week_ago),
        ).fetchone()["n"]
    discoverer = conn.execute(
        """
        SELECT CASE WHEN c.is_private OR u.frozen THEN NULL ELSE u.username END AS username, c.created_at AS at
        FROM checkins c LEFT JOIN users u ON u.id = c.user_id WHERE c.venue_id = %s AND c.is_first
        """,
        (venue_id,),
    ).fetchone()
    total = conn.execute("SELECT count(*)::int AS n FROM checkins WHERE venue_id = %s", (venue_id,)).fetchone()["n"]
    return {
        "today": today,
        "today_checkins": sum(h["checkins"] for h in today),
        "week_checkins": sum(1 for r in rows if r["created_at"] > week_ago),
        "week_people": len(week_people),
        "week_returning": returning,
        "week_new": len(week_people) - returning,
        "weekday": weekday,
        "total_checkins": total,
        "discovered_by": discoverer,
    }
