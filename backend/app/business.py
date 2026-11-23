"""v2 business panel: the business's venue on the server and its check-in statistics.

Everything comes from customers' check-ins (no estimated occupancy any more).
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from app.crowd import report_score, Report
from app.hours import venue_hours

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




def _own_venue(user: dict, venue_id: int) -> None:
    if user.get("role") != "business" or user.get("venue_id") != venue_id:
        raise BusinessError("Bu mekan yalnızca işletmesine açık.", 403)


REGULAR_VISITS = 3  # check-ins in 30 days that make a regular ("müdavim")
MIN_CHECKINS_FOR_QUIET_SLOT = 30
QUIET_SLOT_HOURS = 2


def _level_of(score: float) -> str:
    from app.occupancy import classify

    return classify(score).value


def quietest_slot(check_ins: list[datetime], open_hour: int, close_hour: int) -> dict | None:
    """The two hours of the week with the fewest check-ins while open, from a month of check-ins: "Salı 14–16".
    With few check-ins every hour looks empty, so nothing is said then. A tie: the earliest in the week."""
    if len(check_ins) < MIN_CHECKINS_FOR_QUIET_SLOT:
        return None
    count: dict[tuple[int, int], int] = {}
    for at in check_ins:
        local = at.astimezone(ISTANBUL)
        count[(local.weekday(), local.hour)] = count.get((local.weekday(), local.hour), 0) + 1
    open_hours = (close_hour - open_hour) % 24 or 24
    if open_hours < QUIET_SLOT_HOURS:
        return None
    slots = [
        (count.get((day, start % 24), 0) + count.get((day, (start + 1) % 24), 0), day, start)
        for day in range(7)
        for start in range(open_hour, open_hour + open_hours - QUIET_SLOT_HOURS + 1)
    ]
    checkins, day, start = min(slots)
    return {"weekday": day, "start_hour": start % 24, "hours": QUIET_SLOT_HOURS, "checkins": checkins}


def _quiet_slot(conn: psycopg.Connection, venue_id: int, check_ins: list[datetime]) -> dict | None:
    venue = conn.execute("SELECT category, open_hour, close_hour FROM venues WHERE id = %s", (venue_id,)).fetchone()
    hours = venue_hours(venue, guess=True)
    return quietest_slot(check_ins, hours.open_hour, hours.close_hour)


def venue_stats(conn: psycopg.Connection, user: dict, venue_id: int, now: datetime) -> dict:
    """Today by hour, the last 7 days (people, new / returning) and the last 30 days by weekday."""
    from app.plans import business_access

    _own_venue(user, venue_id)
    if not business_access(conn, user)["stats"]:
        raise BusinessError("İstatistikler aylık pakette. Abonelik > Aylık paket.", 402)
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

    quiet_slot = _quiet_slot(conn, venue_id, [r["created_at"] for r in rows])

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
        "quiet_slot": quiet_slot,
        "total_checkins": total,
        **month_comparison(conn, venue_id, now),
        "discovered_by": discoverer,
    }


def month_comparison(conn: psycopg.Connection, venue_id: int, now: datetime) -> dict:
    """This month so far against the same days of last month ("geçen aya göre +%20"), Istanbul time."""
    local = now.astimezone(ISTANBUL)
    month_start = local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_start = (month_start - timedelta(days=1)).replace(day=1)
    # The same span of last month (to the same day and hour; a shorter month ends at its last day)
    span = local - month_start
    last_end = min(last_start + span, month_start)
    count = lambda a, b: conn.execute(  # noqa: E731
        "SELECT count(*)::int AS n FROM checkins WHERE venue_id = %s AND NOT is_demo AND created_at >= %s AND created_at < %s",
        (venue_id, a, b),
    ).fetchone()["n"]
    this_month, last_month = count(month_start, now), count(last_start, last_end)
    change = None if last_month == 0 else round((this_month - last_month) * 100 / last_month)
    return {"month_checkins": this_month, "last_month_checkins": last_month, "month_change_pct": change}


def month_report(conn: psycopg.Connection, venue_id: int, now: datetime, months_back: int = 0) -> dict:
    """"availo bu ay size 14 müşteri getirdi": a month at the venue, for every plan (the detailed statistics
    are in the Aylık paket). New people: their first check-in there was this month."""
    from app.summary import month_bounds

    start, end = month_bounds(now, months_back)
    end = min(end, now + timedelta(seconds=1))
    return conn.execute(
        """
        SELECT %(month)s AS month,
               count(*)::int AS checkins,
               count(DISTINCT c.user_id)::int AS people,
               count(DISTINCT c.user_id) FILTER (
                   WHERE NOT EXISTS (SELECT 1 FROM checkins o WHERE o.venue_id = c.venue_id AND o.user_id = c.user_id
                                     AND o.created_at < %(start)s))::int AS new_people,
               (SELECT count(*) FROM coupons k JOIN campaigns m ON m.id = k.campaign_id
                WHERE m.venue_id = %(venue)s AND k.redeemed_at >= %(start)s AND k.redeemed_at < %(end)s)::int AS coupons_used,
               (SELECT count(*) FROM campaigns m WHERE m.venue_id = %(venue)s AND NOT m.standing
                AND m.starts_at >= %(start)s AND m.starts_at < %(end)s)::int AS campaigns
        FROM checkins c
        WHERE c.venue_id = %(venue)s AND c.created_at >= %(start)s AND c.created_at < %(end)s
        """,
        {"venue": venue_id, "start": start, "end": end, "month": start.strftime("%Y-%m")},
    ).fetchone()


def business_report(conn: psycopg.Connection, user: dict, now: datetime, months_back: int = 0) -> dict:
    if user.get("role") != "business" or not user.get("venue_id"):
        raise BusinessError("Yalnızca mekanı olan işletme hesapları için.", 403)
    return month_report(conn, user["venue_id"], now, months_back)


def sales_pitch(conn: psycopg.Connection, admin: dict, venue_id: int, now: datetime) -> dict:
    """Yönetici: numbers to take to a venue that has not joined ("Geçen hafta 35 kişi check-in yaptı, en
    kalabalık saatiniz 15:00")."""
    from app.moderation import require_admin

    require_admin(admin)
    week = conn.execute(
        """
        SELECT count(*)::int AS checkins, count(DISTINCT user_id)::int AS people,
               (SELECT extract(hour FROM created_at AT TIME ZONE 'Europe/Istanbul')::int FROM checkins
                WHERE venue_id = %(v)s AND created_at > %(since)s GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1) AS busiest_hour
        FROM checkins WHERE venue_id = %(v)s AND created_at > %(since)s AND created_at <= %(now)s
        """,
        {"v": venue_id, "since": now - timedelta(days=7), "now": now},
    ).fetchone()
    other = conn.execute(
        """
        SELECT (SELECT count(*) FROM favorites WHERE venue_id = %(v)s)::int AS favorites,
               (SELECT count(*) FROM checkins WHERE venue_id = %(v)s AND created_at > %(month)s)::int AS month_checkins,
               (SELECT count(*) FROM reviews WHERE venue_id = %(v)s AND removed_at IS NULL)::int AS reviews,
               (SELECT round(avg(rating)::numeric, 1)::float FROM reviews WHERE venue_id = %(v)s AND removed_at IS NULL) AS rating,
               EXISTS (SELECT 1 FROM users WHERE venue_id = %(v)s AND role = 'business') AS joined,
               (SELECT count(*) FROM venues o JOIN users b ON b.venue_id = o.id AND b.role = 'business'
                JOIN venues me ON me.id = %(v)s
                WHERE o.id <> me.id AND ST_DWithin(o.location, me.location, 1000))::int AS nearby_joined
        """,
        {"v": venue_id, "month": now - timedelta(days=30)},
    ).fetchone()
    return {
        "week_checkins": week["checkins"],
        "week_people": week["people"],
        "busiest_hour": week["busiest_hour"],
        **other,
    }
