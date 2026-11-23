"""Coming back: the one reminder that is not an event (asked for: after 4 days without a check-in), and the
"Sen yokken" card the app shows when it is opened after a while."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from app.config import settings

ISTANBUL = ZoneInfo(settings.dummy_timezone)
COMEBACK_AFTER = timedelta(days=4)
DAYTIME = (10, 21)  # sent only between 10:00 and 21:00 in Istanbul

FRIENDS = """(
    SELECT CASE WHEN requester_id = u.id THEN addressee_id ELSE requester_id END
    FROM friendships WHERE status = 'accepted' AND u.id IN (requester_id, addressee_id)
)"""


def remind_inactive(conn: psycopg.Connection, now: datetime) -> int:
    """4 days without a check-in: one 🔔 (and so one phone notification) per quiet spell, with something
    worth knowing (where friends went meanwhile). Returns how many were written."""
    if not DAYTIME[0] <= now.astimezone(ISTANBUL).hour < DAYTIME[1]:
        return 0
    return conn.execute(
        f"""
        WITH quiet AS (
            SELECT u.id, COALESCE((SELECT max(created_at) FROM checkins c WHERE c.user_id = u.id), u.created_at) AS last
            FROM users u
            WHERE u.role = 'personal' AND NOT u.is_guest AND NOT u.frozen AND u.username IS NOT NULL
        )
        INSERT INTO user_notices (user_id, kind, body, created_at)
        SELECT q.id, 'comeback',
               floor(extract(epoch FROM %(now)s - q.last) / 86400)::int || ' gündür check-in yapmadın. ' ||
               CASE WHEN f.places > 0 THEN 'Arkadaşların bu arada ' || f.places || ' farklı yere gitti; bir bak!'
                    ELSE 'Yakınında şu an sakin mekanlar olabilir; bir bak!' END,
               %(now)s
        FROM quiet q
        CROSS JOIN LATERAL (
            SELECT count(DISTINCT c.venue_id)::int AS places FROM checkins c, users u
            WHERE u.id = q.id AND c.created_at > q.last AND c.created_at <= %(now)s AND NOT c.is_private
              AND c.user_id IN {FRIENDS}
        ) f
        WHERE q.last < %(cut)s
          AND NOT EXISTS (SELECT 1 FROM user_notices n WHERE n.user_id = q.id AND n.kind = 'comeback' AND n.created_at > q.last)
        """,
        {"now": now, "cut": now - COMEBACK_AFTER},
    ).rowcount


def while_away(conn: psycopg.Connection, me: dict, since: datetime, now: datetime) -> dict:
    """"Sen yokken": friends' check-ins and new 🔔 items since the app was last opened, and favourites that
    are quiet right now."""
    from app.checkins import load_crowds
    from app.social import notifications

    friends = conn.execute(
        f"""
        SELECT v.name, count(*)::int AS n
        FROM checkins c JOIN venues v ON v.id = c.venue_id, users u
        WHERE u.id = %(me)s AND c.created_at > %(since)s AND c.created_at <= %(now)s AND NOT c.is_private
          AND c.user_id IN {FRIENDS}
        GROUP BY v.name ORDER BY n DESC, v.name LIMIT 20
        """,
        {"me": me["id"], "since": since, "now": now},
    ).fetchall()
    favorites = conn.execute(
        "SELECT f.venue_id, v.name FROM favorites f JOIN venues v ON v.id = f.venue_id WHERE f.user_id = %s", (me["id"],)
    ).fetchall()
    crowds = load_crowds(conn, [f["venue_id"] for f in favorites], now) if favorites else {}
    return {
        "friend_checkins": sum(f["n"] for f in friends),
        "friend_places": [f["name"] for f in friends[:3]],
        "notifications": sum(1 for n in notifications(conn, me, now) if n["at"] > since),
        "quiet_favorites": [
            {"id": f["venue_id"], "name": f["name"]}
            for f in favorites
            if crowds[f["venue_id"]].state == "live" and crowds[f["venue_id"]].level == "low"
        ][:3],
    }
