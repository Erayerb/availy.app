"""v2 leaderboard (weekly / all time, friends / everyone) and in-app notifications."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from app.safety import BLOCKED, hidden_reply

ISTANBUL = ZoneInfo("Europe/Istanbul")
LEADERBOARD_LIMIT = 50
NOTIFICATION_DAYS = 30


def week_start(now: datetime) -> datetime:
    """Monday 00:00 in Istanbul: the weekly ranking starts again then."""
    local = now.astimezone(ISTANBUL)
    return (local - timedelta(days=local.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)


def leaderboard(conn: psycopg.Connection, me: dict, period: str, scope: str, now: datetime) -> dict:
    """Ranked rows (same points, same rank) and my own place, also when I am not in the list."""
    since = week_start(now) if period == "week" else datetime.min.replace(tzinfo=ISTANBUL)
    friends = """
        SELECT CASE WHEN requester_id = %(me)s THEN addressee_id ELSE requester_id END
        FROM friendships WHERE status = 'accepted' AND %(me)s IN (requester_id, addressee_id)
    """
    # Friends: me and my friends, also with 0 points. Everyone: registered people who want to be shown
    people = (
        f"u.id = %(me)s OR (u.id IN ({friends}) AND NOT u.frozen)"
        if scope == "friends"
        else f"u.id = %(me)s OR (u.show_in_leaderboard AND NOT u.is_guest AND u.role = 'personal' AND u.username IS NOT NULL AND u.id NOT IN {BLOCKED})"
    )
    rows = conn.execute(
        f"""
        WITH scores AS (
            SELECT u.id, u.username, COALESCE(sum(p.amount), 0)::int AS points
            FROM users u LEFT JOIN points p ON p.user_id = u.id AND p.created_at >= %(since)s
            WHERE {people}
            GROUP BY u.id, u.username
        )
        SELECT id, username, points, (RANK() OVER (ORDER BY points DESC))::int AS rank
        FROM scores WHERE points > 0 OR %(friends_scope)s OR id = %(me)s
        ORDER BY points DESC, lower(username)
        """,
        {"me": me["id"], "since": since, "friends_scope": scope == "friends"},
    ).fetchall()
    mine = next((r for r in rows if r["id"] == me["id"]), None)
    shown = [r for r in rows if r["id"] != me["id"] or r["points"] > 0 or scope == "friends"][:LEADERBOARD_LIMIT]
    return {
        "rows": [{"rank": r["rank"], "username": r["username"], "points": r["points"], "me": r["id"] == me["id"]} for r in shown],
        "me": {"rank": mine["rank"], "points": mine["points"]} if mine else None,
    }


def notifications(conn: psycopg.Connection, me: dict, now: datetime) -> list[dict]:
    """Newest first: friend requests to me, my requests that were accepted, replies to my reviews,
    and rewards from venues I discovered (always kept: shown at the counter)."""
    return conn.execute(
        f"""
        SELECT * FROM (
            SELECT 'friend_request' AS kind, f.created_at AS at, u.username, NULL::bigint AS venue_id,
                   NULL AS venue_name, NULL AS body
            FROM friendships f JOIN users u ON u.id = f.requester_id
            WHERE f.addressee_id = %(me)s AND f.status = 'pending' AND NOT u.frozen
            UNION ALL
            SELECT 'friend_accepted', f.accepted_at, u.username, NULL, NULL, NULL
            FROM friendships f JOIN users u ON u.id = f.addressee_id
            WHERE f.requester_id = %(me)s AND f.status = 'accepted' AND f.accepted_at > %(since)s AND NOT u.frozen
            UNION ALL
            SELECT 'reply', p.created_at, u.username, v.id, v.name, p.body
            FROM review_replies p JOIN reviews r ON r.id = p.review_id JOIN users u ON u.id = p.user_id
            JOIN venues v ON v.id = r.venue_id
            WHERE r.user_id = %(me)s AND p.user_id <> %(me)s AND p.created_at > %(since)s
              AND p.user_id NOT IN {BLOCKED} AND NOT {hidden_reply("p")}
            UNION ALL
            SELECT 'reward', w.created_at, NULL, v.id, v.name, w.message
            FROM discoverer_rewards w JOIN venues v ON v.id = w.venue_id
            WHERE w.user_id = %(me)s
            UNION ALL
            -- Likes and comments on my check-ins
            SELECT 'checkin_like', l.created_at, u.username, v.id, v.name, NULL
            FROM checkin_likes l JOIN checkins c ON c.id = l.checkin_id JOIN users u ON u.id = l.user_id
            JOIN venues v ON v.id = c.venue_id
            WHERE c.user_id = %(me)s AND l.user_id <> %(me)s AND l.created_at > %(since)s AND l.user_id NOT IN {BLOCKED}
            UNION ALL
            SELECT 'checkin_comment', k.created_at, u.username, v.id, v.name, k.body
            FROM checkin_comments k JOIN checkins c ON c.id = k.checkin_id JOIN users u ON u.id = k.user_id
            JOIN venues v ON v.id = c.venue_id
            WHERE c.user_id = %(me)s AND k.user_id <> %(me)s AND k.created_at > %(since)s AND k.user_id NOT IN {BLOCKED}
            UNION ALL
            -- A venue I checked in at (or discovered) started a loyalty program I have not joined
            SELECT 'loyalty', p.activated_at, NULL, v.id, v.name,
                   CASE WHEN p.kind = 'stamps' THEN p.stamps_required || ' damga = ' || p.reward
                        ELSE p.price || ' ₺/ay · ' || p.perk END
            FROM loyalty_programs p JOIN venues v ON v.id = p.venue_id
            WHERE p.active AND p.activated_at > %(since)s
              AND EXISTS (SELECT 1 FROM checkins c WHERE c.venue_id = p.venue_id AND c.user_id = %(me)s)
              AND NOT EXISTS (SELECT 1 FROM loyalty_members m WHERE m.venue_id = p.venue_id AND m.user_id = %(me)s)
        ) items
        ORDER BY at DESC LIMIT 50
        """,
        {"me": me["id"], "since": now - timedelta(days=NOTIFICATION_DAYS)},
    ).fetchall()
