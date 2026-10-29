"""v2 levels: Yeni Gelen → Kâşif → Mahalleli → Semt Elçisi, from points, discoveries and where the person
goes (never stored: worked out from check-ins and points, so they cannot be lost or drift)."""
import psycopg

REGULAR_VISITS = 3  # check-ins at one venue that make it "my place" for Mahalleli
# (id, name, points, discoveries, regular venues, venues in one district); Kâşif: points OR a discovery
LEVELS = [
    ("newcomer", "Yeni Gelen", 0, 0, 0, 0),
    ("explorer", "Kâşif", 100, 1, 0, 0),
    ("local", "Mahalleli", 500, 0, 3, 0),
    ("ambassador", "Semt Elçisi", 2000, 0, 0, 10),
]


def _facts(conn: psycopg.Connection, user_id: int) -> dict:
    return conn.execute(
        """
        SELECT
            (SELECT COALESCE(sum(amount), 0) FROM points WHERE user_id = %(id)s)::int AS points,
            (SELECT count(*) FROM checkins WHERE user_id = %(id)s AND is_first)::int AS discoveries,
            (SELECT count(*) FROM (
                SELECT venue_id FROM checkins WHERE user_id = %(id)s AND NOT is_demo
                GROUP BY venue_id HAVING count(*) >= %(regular)s) r)::int AS regular_venues,
            (SELECT COALESCE(max(n), 0) FROM (
                SELECT count(DISTINCT c.venue_id) AS n FROM checkins c JOIN venues v ON v.id = c.venue_id
                WHERE c.user_id = %(id)s AND NOT c.is_demo AND v.district <> '' GROUP BY v.district) d)::int AS district_venues
        """,
        {"id": user_id, "regular": REGULAR_VISITS},
    ).fetchone()


def _reached(level: tuple, f: dict) -> bool:
    _, _, points, discoveries, regular, district = level
    if discoveries:  # Kâşif: enough points, or one discovery
        return f["points"] >= points or f["discoveries"] >= discoveries
    return f["points"] >= points and f["regular_venues"] >= regular and f["district_venues"] >= district


def _missing(level: tuple, f: dict) -> tuple[list[str], float]:
    """What is left for this level, and how far along (0–1)."""
    _, _, points, discoveries, regular, district = level
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
    return parts, sum(shares) / len(shares)


def user_level(conn: psycopg.Connection, user_id: int) -> dict:
    """{"id", "name", "rank" (0–3), "next": {"name", "missing": [...], "progress"} or None at the top}."""
    f = _facts(conn, user_id)
    rank = 0
    for i, level in enumerate(LEVELS[1:], start=1):
        if not _reached(level, f):
            break
        rank = i
    current = LEVELS[rank]
    upcoming = None
    if rank + 1 < len(LEVELS):
        nxt = LEVELS[rank + 1]
        missing, progress = _missing(nxt, f)
        upcoming = {"name": nxt[1], "missing": missing, "progress": round(progress, 2)}
    return {"id": current[0], "name": current[1], "rank": rank, "next": upcoming}
