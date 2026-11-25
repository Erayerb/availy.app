"""Doing it together: "Birlikte check-in" (friends at the same venue within an hour get +10 each),
"Grup serisi" (weeks in a row in which every member checked in) and "Seri kurtarma" (a friend may cover a
day without a check-in, so someone's daily streak goes on: 2 a month, availo+ 10).
"""
from datetime import date, datetime, timedelta

import psycopg

from app.streaks import ISTANBUL, _week_start, day_streak, istanbul_day

TOGETHER_WINDOW = timedelta(hours=1)
TOGETHER_POINTS = 10
SAVE_EVERY = timedelta(days=30)
# Saves per 30 days: availo+ gets ten
SAVES = {"premium": 10}
SAVES_DEFAULT = 2

FRIENDS = """(SELECT addressee_id FROM friendships WHERE requester_id = %(me)s AND status = 'accepted'
              UNION SELECT requester_id FROM friendships WHERE addressee_id = %(me)s AND status = 'accepted')"""


class StreakError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def together_bonus(conn: psycopg.Connection, user: dict, checkin: dict, now: datetime) -> list[str]:
    """Friends who checked in here (openly) within the last hour: both get +10, once per pair of check-ins.
    Returns their user names (for "Ayşe ile birliktesiniz")."""
    if checkin.get("is_private") or user.get("is_guest"):
        return []
    others = conn.execute(
        f"""
        SELECT DISTINCT ON (c.user_id) c.id, c.user_id, u.username FROM checkins c JOIN users u ON u.id = c.user_id
        WHERE c.venue_id = %(venue)s AND c.id <> %(id)s AND c.created_at >= %(since)s AND c.created_at <= %(now)s
          AND NOT c.is_private AND NOT c.is_demo AND u.share_checkins AND c.user_id IN {FRIENDS}
        ORDER BY c.user_id, c.created_at DESC
        """,
        {"venue": checkin["venue_id"], "id": checkin["id"], "since": now - TOGETHER_WINDOW, "now": now, "me": user["id"]},
    ).fetchall()
    names = []
    for other in others:
        added = conn.execute(
            "INSERT INTO checkin_together (checkin_id, other_checkin_id) VALUES (%s, %s), (%s, %s) ON CONFLICT DO NOTHING",
            (checkin["id"], other["id"], other["id"], checkin["id"]),
        ).rowcount
        if not added:
            continue
        conn.execute(
            """
            INSERT INTO points (user_id, amount, reason, checkin_id, created_at)
            VALUES (%s, %s, 'together', %s, %s), (%s, %s, 'together', %s, %s)
            """,
            (user["id"], TOGETHER_POINTS, checkin["id"], now, other["user_id"], TOGETHER_POINTS, other["id"], now),
        )
        names.append(other["username"])
    return names


def _checked_in_week(conn: psycopg.Connection, user_id: int, week: datetime) -> bool:
    end = week + timedelta(days=7)
    if conn.execute(
        "SELECT 1 FROM checkins WHERE user_id = %s AND NOT is_demo AND created_at >= %s AND created_at < %s LIMIT 1",
        (user_id, week, end),
    ).fetchone():
        return True
    return conn.execute(
        "SELECT 1 FROM streak_saves WHERE user_id = %s AND day >= %s AND day < %s", (user_id, week.date(), end.date())
    ).fetchone() is not None


def _checked_in_day(conn: psycopg.Connection, user_id: int, day: date) -> bool:
    """A check-in that day (Istanbul), or a friend saved it."""
    start = datetime.combine(day, datetime.min.time(), ISTANBUL)
    if conn.execute(
        "SELECT 1 FROM checkins WHERE user_id = %s AND NOT is_demo AND created_at >= %s AND created_at < %s LIMIT 1",
        (user_id, start, start + timedelta(days=1)),
    ).fetchone():
        return True
    return conn.execute("SELECT 1 FROM streak_saves WHERE user_id = %s AND day = %s", (user_id, day)).fetchone() is not None


def friend_streaks(conn: psycopg.Connection, me: dict, friend_ids: list[int], now: datetime) -> dict[int, dict]:
    """For the friends list: each friend's streak and whether today still needs a check-in (or a save)."""
    today = istanbul_day(now)
    can_save = save_allowed(conn, me, now)
    out = {}
    for fid in friend_ids:
        streak = day_streak(conn, fid, now)
        at_risk = streak >= 1 and not _checked_in_day(conn, fid, today)
        out[fid] = {"streak": streak, "at_risk": at_risk, "can_save": at_risk and can_save}
    return out


def save_allowed(conn: psycopg.Connection, me: dict, now: datetime) -> bool:
    """Saves in the last 30 days: 2, availo+ 10."""
    plan = conn.execute("SELECT plan FROM users WHERE id = %s", (me["id"],)).fetchone()["plan"]
    used = conn.execute(
        "SELECT count(*) AS n FROM streak_saves WHERE saved_by = %s AND created_at > %s", (me["id"], now - SAVE_EVERY)
    ).fetchone()["n"]
    return used < SAVES.get(plan or "", SAVES_DEFAULT)


def save_streak(conn: psycopg.Connection, me: dict, username: str, now: datetime) -> dict:
    friend = conn.execute(
        f"SELECT id, username FROM users WHERE lower(username) = %(name)s AND id IN {FRIENDS}",
        {"name": username.strip().lstrip("@").lower(), "me": me["id"]},
    ).fetchone()
    if friend is None:
        raise StreakError("Yalnızca arkadaşlarının serisini kurtarabilirsin.", 404)
    today = istanbul_day(now)
    if day_streak(conn, friend["id"], now) < 1 or _checked_in_day(conn, friend["id"], today):
        raise StreakError("Bugün kurtarılacak bir seri yok.")
    if not save_allowed(conn, me, now):
        raise StreakError("Bu ayki seri kurtarma hakkın doldu (availo+'ta ayda 10).", 429)
    conn.execute(
        "INSERT INTO streak_saves (user_id, day, saved_by, created_at) VALUES (%s, %s, %s, %s)",
        (friend["id"], today, me["id"], now),
    )
    return {"username": friend["username"], "streak": day_streak(conn, friend["id"], now)}


def group_streak(conn: psycopg.Connection, group_id: int, me: dict, now: datetime) -> dict:
    """Weeks in a row in which every member checked in; this week's missing members and days left."""
    if conn.execute(
        "SELECT 1 FROM group_members WHERE group_id = %s AND user_id = %s AND status = 'member'", (group_id, me["id"])
    ).fetchone() is None:
        raise StreakError("Bu grubun üyesi değilsin.", 403)
    members = conn.execute(
        """
        SELECT u.id, u.username, m.created_at FROM group_members m JOIN users u ON u.id = m.user_id
        WHERE m.group_id = %s AND m.status = 'member' AND NOT u.frozen
        """,
        (group_id,),
    ).fetchall()
    week = _week_start(now)
    missing = [m["username"] for m in members if not _checked_in_week(conn, m["id"], week)]
    # This week counts once everyone is in; until then the streak is the weeks before it
    weeks = 0 if missing else 1
    w = week - timedelta(weeks=1)
    while weeks < 104:
        # Only the people who were already in the group that week
        required = [m for m in members if m["created_at"] < w + timedelta(days=7)]
        if not required or not all(_checked_in_week(conn, m["id"], w) for m in required):
            break
        weeks += 1
        w -= timedelta(weeks=1)
    days_left = 7 - now.astimezone(ISTANBUL).weekday()
    return {"weeks": weeks, "missing": missing, "days_left": days_left}

