"""v2 levels: Yeni gelen → Kâşif → Mahalleli → Semt elçisi, from points, discoveries and where the person
goes (never stored: worked out from check-ins and points, so they cannot be lost or drift)."""
from datetime import datetime, timedelta

import psycopg

REGULAR_VISITS = 3  # check-ins at one venue that make it "my place" for Mahalleli
# (id, name, points, discoveries, regular venues, venues in one district, every badge); Kâşif: points OR a
# discovery. Semt elçisi also needs every badge (the first-week tasks are one of them: "Hızlı başlangıç")
LEVELS = [
    ("newcomer", "Yeni gelen", 0, 0, 0, 0, False),
    ("explorer", "Kâşif", 100, 1, 0, 0, False),
    ("local", "Mahalleli", 500, 0, 3, 0, False),
    ("ambassador", "Semt elçisi", 2000, 0, 0, 10, True),
]


def badge_count() -> int:
    from app.checkins import BADGES

    return len(BADGES)


FACTS = """
    SELECT
        u.username,
        (SELECT COALESCE(sum(amount), 0) FROM points WHERE user_id = u.id)::int AS points,
        (SELECT count(*) FROM checkins WHERE user_id = u.id AND is_first)::int AS discoveries,
        (SELECT count(*) FROM (
            SELECT venue_id FROM checkins WHERE user_id = u.id AND NOT is_demo
            GROUP BY venue_id HAVING count(*) >= %(regular)s) r)::int AS regular_venues,
        (SELECT COALESCE(max(n), 0) FROM (
            SELECT count(DISTINCT c.venue_id) AS n FROM checkins c JOIN venues v ON v.id = c.venue_id
            WHERE c.user_id = u.id AND NOT c.is_demo AND v.district <> '' GROUP BY v.district) d)::int AS district_venues,
        (SELECT count(*) FROM user_badges WHERE user_id = u.id)::int AS badges
    FROM users u
"""


def _facts(conn: psycopg.Connection, user_id: int) -> dict:
    return conn.execute(f"{FACTS} WHERE u.id = %(id)s", {"id": user_id, "regular": REGULAR_VISITS}).fetchone()


def _reached(level: tuple, f: dict) -> bool:
    _, _, points, discoveries, regular, district, all_badges = level
    if discoveries:  # Kâşif: enough points, or one discovery
        return f["points"] >= points or f["discoveries"] >= discoveries
    badges_ok = not all_badges or f["badges"] >= badge_count()
    return f["points"] >= points and f["regular_venues"] >= regular and f["district_venues"] >= district and badges_ok


def _missing(level: tuple, f: dict) -> tuple[list[str], float]:
    """What is left for this level, and how far along (0–1)."""
    _, _, points, discoveries, regular, district, all_badges = level
    if discoveries:
        left = max(0, points - f["points"])
        return [f"{left} puan ya da 1 keşif"], min(1, f["points"] / points)
    parts, shares = [], []
    if points:
        if f["points"] < points:
            parts.append(f"{points - f['points']} puan")
        shares.append(min(1, f["points"] / points))
    if regular:
        if f["regular_venues"] < regular:
            parts.append(f"{regular - f['regular_venues']} mekanda daha {REGULAR_VISITS}. check-in")
        shares.append(min(1, f["regular_venues"] / regular))
    if district:
        if f["district_venues"] < district:
            parts.append(f"bir semtte {district - f['district_venues']} farklı mekan daha")
        shares.append(min(1, f["district_venues"] / district))
    if all_badges:
        total = badge_count()
        if f["badges"] < total:
            parts.append(f"{total - f['badges']} rozet daha (bütün rozetler)")
        shares.append(min(1, f["badges"] / total))
    return parts, sum(shares) / len(shares)


def _rank(f: dict) -> int:
    rank = 0
    for i, level in enumerate(LEVELS[1:], start=1):
        if not _reached(level, f):
            break
        rank = i
    return rank


def level_ids(conn: psycopg.Connection, usernames: list[str]) -> dict[str, str]:
    """Username → level id, for lists of people (the ranking, Akış)."""
    if not usernames:
        return {}
    rows = conn.execute(
        f"{FACTS} WHERE u.username = ANY(%(names)s)", {"names": usernames, "regular": REGULAR_VISITS}
    ).fetchall()
    return {f["username"]: LEVELS[_rank(f)][0] for f in rows}


def user_level(conn: psycopg.Connection, user_id: int) -> dict:
    """{"id", "name", "rank" (0–3), "next": {"name", "missing": [...], "progress"} or None at the top}."""
    f = _facts(conn, user_id)
    rank = _rank(f)
    current = LEVELS[rank]
    upcoming = None
    if rank + 1 < len(LEVELS):
        nxt = LEVELS[rank + 1]
        missing, progress = _missing(nxt, f)
        upcoming = {"name": nxt[1], "missing": missing, "progress": round(progress, 2)}
    return {"id": current[0], "name": current[1], "rank": rank, "next": upcoming}


# Reaching a level (once each): points and a gift. Kâşif: one standing reward without points ("hoş geldin");
# Mahalleli: a week of availo+; Semt elçisi: a month (and the gold frame the ranking already gives)
LEVEL_POINTS = 30
LEVEL_GIFTS = {
    "explorer": ("🧭", None, "hoş geldin hediyen: bir mekan ödülünü puansız al"),
    "local": ("🏡", 7, "1 hafta availo+ hediye"),
    "ambassador": ("👑", 30, "1 ay availo+ hediye"),
}


def grant_plus(conn: psycopg.Connection, user_id: int, days: int, now: datetime) -> None:
    """availo+ for a while; a bought one (no end date) is left as it is, a given one gets longer."""
    row = conn.execute("SELECT plan, plus_until FROM users WHERE id = %s", (user_id,)).fetchone()
    if row["plan"] == "premium" and row["plus_until"] is None:
        return
    start = max(row["plus_until"] or now, now)
    conn.execute("UPDATE users SET plan = 'premium', plus_until = %s WHERE id = %s", (start + timedelta(days=days), user_id))


def reward_levels(conn: psycopg.Connection, user_id: int, now: datetime) -> list[dict]:
    """Levels reached since the last look: each written down once with +30 points and its gift; returned to be
    celebrated like a badge ("Mahalleli oldun! 1 hafta availo+ hediye")."""
    new = []
    for _ in range(len(LEVELS)):  # the points may reach the next level too
        rank = _rank(_facts(conn, user_id))
        known = {r["level_id"] for r in conn.execute("SELECT level_id FROM level_rewards WHERE user_id = %s", (user_id,))}
        fresh = [lvl for lvl in LEVELS[1 : rank + 1] if lvl[0] not in known]
        if not fresh:
            break
        for level_id, name, *_ in fresh:
            conn.execute(
                "INSERT INTO level_rewards (user_id, level_id, created_at) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                (user_id, level_id, now),
            )
            conn.execute(
                "INSERT INTO points (user_id, amount, reason, created_at) VALUES (%s, %s, 'level', %s)", (user_id, LEVEL_POINTS, now)
            )
            icon, days, gift = LEVEL_GIFTS[level_id]
            if days:
                grant_plus(conn, user_id, days, now)
            new.append({"id": f"level_{level_id}", "name": f"{name} oldun! {gift[0].upper()}{gift[1:]}", "icon": icon, "points": LEVEL_POINTS})
    return new


def welcome_left(conn: psycopg.Connection, user_id: int) -> bool:
    """Kâşif's gift not used yet: one standing reward without points."""
    return conn.execute(
        "SELECT 1 FROM level_rewards WHERE user_id = %s AND level_id = 'explorer' AND welcome_used_at IS NULL", (user_id,)
    ).fetchone() is not None
