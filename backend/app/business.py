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
    # A venue has one business account (until ownership checks exist, the first one keeps it)
    taken = conn.execute(
        "SELECT 1 FROM users WHERE role = 'business' AND venue_id = %s AND id <> %s", (venue_id, user["id"])
    ).fetchone()
    if taken:
        raise BusinessError("Bu mekan başka bir işletme hesabına bağlı. Mekan senin ise bize yaz: Daha fazla → Hata bildir ve iletişim.", 409)
    return conn.execute("UPDATE users SET venue_id = %s WHERE id = %s RETURNING venue_id", (venue_id, user["id"])).fetchone()


MAX_REWARD = 120


def _own_venue(user: dict, venue_id: int) -> None:
    if user.get("role") != "business" or user.get("venue_id") != venue_id:
        raise BusinessError("Bu mekan yalnızca işletmesine açık.", 403)


def reward_discoverer(conn: psycopg.Connection, user: dict, venue_id: int, message: str, now: datetime) -> dict:
    """The venue's business sends a reward to whoever made its first check-in (once)."""
    _own_venue(user, venue_id)
    text = " ".join(message.split())
    if not text:
        raise BusinessError("Ödülü yaz (ör. Bir sonraki kahven bizden).")
    if len(text) > MAX_REWARD:
        raise BusinessError(f"En fazla {MAX_REWARD} karakter yazabilirsin.")
    first = conn.execute("SELECT user_id FROM checkins WHERE venue_id = %s AND is_first", (venue_id,)).fetchone()
    if first is None or first["user_id"] is None:
        raise BusinessError("Mekanını keşfeden kişi bulunamadı.", 404)
    row = conn.execute(
        """
        INSERT INTO discoverer_rewards (venue_id, user_id, message, created_at) VALUES (%s, %s, %s, %s)
        ON CONFLICT (venue_id) DO NOTHING RETURNING message
        """,
        (venue_id, first["user_id"], text, now),
    ).fetchone()
    if row is None:
        raise BusinessError("Keşfedene ödülü zaten gönderdin.", 409)
    return row


REGULAR_VISITS = 3  # check-ins in 30 days that make a regular ("müdavim")


def _level_of(score: float) -> str:
    from app.occupancy import classify

    return classify(score).value


def venue_stats(conn: psycopg.Connection, user: dict, venue_id: int, now: datetime) -> dict:
    """Today by hour, the last 7 days (people, new / returning) and the last 30 days by weekday."""
    _own_venue(user, venue_id)
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
        SELECT CASE WHEN c.is_private OR u.frozen THEN NULL ELSE u.username END AS username, c.created_at AS at,
               c.user_id IS NOT NULL AS can_reward, w.message AS reward
        FROM checkins c LEFT JOIN users u ON u.id = c.user_id
        LEFT JOIN discoverer_rewards w ON w.venue_id = c.venue_id
        WHERE c.venue_id = %s AND c.is_first
        """,
        (venue_id,),
    ).fetchone()
    total = conn.execute("SELECT count(*)::int AS n FROM checkins WHERE venue_id = %s", (venue_id,)).fetchone()["n"]
    # Müşteriler: how often people came in the last 30 days (anonymous counts only)
    per_person: dict[int, int] = {}
    for r in rows:
        if r["user_id"] is not None:
            per_person[r["user_id"]] = per_person.get(r["user_id"], 0) + 1
    visits = sorted(per_person.values(), reverse=True)
    return {
        "month_people": len(visits),
        "regulars": sum(1 for n in visits if n >= REGULAR_VISITS),
        "top_visits": visits[:5],
        "today": today,
        "today_checkins": sum(h["checkins"] for h in today),
        "week_checkins": sum(1 for r in rows if r["created_at"] > week_ago),
        "week_people": len(week_people),
        "week_returning": returning,
        "weekday": weekday,
        "total_checkins": total,
        "discovered_by": discoverer,
    }
