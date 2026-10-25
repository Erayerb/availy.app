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


def leaderboard(conn: psycopg.Connection, me: dict, period: str, scope: str, now: datetime, group_id: int | None = None) -> dict:
    """Ranked rows (same points, same rank) and my own place, also when I am not in the list.
    `scope` "group": the members of `group_id` (the caller checks that I am one)."""
    since = week_start(now) if period == "week" else datetime.min.replace(tzinfo=ISTANBUL)
    friends = """
        SELECT CASE WHEN requester_id = %(me)s THEN addressee_id ELSE requester_id END
        FROM friendships WHERE status = 'accepted' AND %(me)s IN (requester_id, addressee_id)
    """
    # Friends: me and my friends, also with 0 points. Everyone: registered people who want to be shown
    # Group: its members
    people = (
        f"u.id = %(me)s OR (u.id IN ({friends}) AND NOT u.frozen)"
        if scope == "friends"
        else "u.id IN (SELECT user_id FROM group_members WHERE group_id = %(group)s AND status = 'member') AND NOT u.frozen"
        if scope == "group"
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
        {"me": me["id"], "since": since, "friends_scope": scope in ("friends", "group"), "group": group_id},
    ).fetchall()
    mine = next((r for r in rows if r["id"] == me["id"]), None)
    shown = [r for r in rows if r["id"] != me["id"] or r["points"] > 0 or scope in ("friends", "group")][:LEADERBOARD_LIMIT]
    return {
        "rows": [{"rank": r["rank"], "username": r["username"], "points": r["points"], "me": r["id"] == me["id"]} for r in shown],
        "me": {"rank": mine["rank"], "points": mine["points"]} if mine else None,
    }


def notifications(conn: psycopg.Connection, me: dict, now: datetime) -> list[dict]:
    """Newest first: friend requests to me, my requests that were accepted, replies to my reviews,
    and rewards from venues I discovered (always kept: shown at the counter).

    Items stay after they are acted on (a request accepted, a program joined; `done` tells) until
    the user deletes them; "Temizle" deletes everything up to now.
    """
    rows = conn.execute(
        f"""
        SELECT * FROM (
            SELECT 'friend_request' AS kind, f.created_at AS at, u.username, NULL::bigint AS venue_id,
                   NULL AS venue_name, NULL AS body, f.status = 'accepted' AS done
            FROM friendships f JOIN users u ON u.id = f.requester_id
            WHERE f.addressee_id = %(me)s AND (f.status = 'pending' OR f.created_at > %(since)s) AND NOT u.frozen
            UNION ALL
            SELECT 'friend_accepted', f.accepted_at, u.username, NULL, NULL, NULL, false
            FROM friendships f JOIN users u ON u.id = f.addressee_id
            WHERE f.requester_id = %(me)s AND f.status = 'accepted' AND f.accepted_at > %(since)s AND NOT u.frozen
            UNION ALL
            SELECT 'reply', p.created_at, u.username, v.id, v.name, p.body, false
            FROM review_replies p JOIN reviews r ON r.id = p.review_id JOIN users u ON u.id = p.user_id
            JOIN venues v ON v.id = r.venue_id
            WHERE r.user_id = %(me)s AND p.user_id <> %(me)s AND p.created_at > %(since)s
              AND p.user_id NOT IN {BLOCKED} AND NOT {hidden_reply("p")}
            UNION ALL
            SELECT 'reward', w.created_at, NULL, v.id, v.name, w.message, false
            FROM discoverer_rewards w JOIN venues v ON v.id = w.venue_id
            WHERE w.user_id = %(me)s
            UNION ALL
            -- Likes and comments on my check-ins
            SELECT 'checkin_like', l.created_at, u.username, v.id, v.name, NULL, false
            FROM checkin_likes l JOIN checkins c ON c.id = l.checkin_id JOIN users u ON u.id = l.user_id
            JOIN venues v ON v.id = c.venue_id
            WHERE c.user_id = %(me)s AND l.user_id <> %(me)s AND l.created_at > %(since)s AND l.user_id NOT IN {BLOCKED}
            UNION ALL
            SELECT 'checkin_comment', k.created_at, u.username, v.id, v.name, k.body, false
            FROM checkin_comments k JOIN checkins c ON c.id = k.checkin_id JOIN users u ON u.id = k.user_id
            JOIN venues v ON v.id = c.venue_id
            WHERE c.user_id = %(me)s AND k.user_id <> %(me)s AND k.created_at > %(since)s AND k.user_id NOT IN {BLOCKED}
            UNION ALL
            -- Invited to a group (done: I joined it)
            SELECT 'group_invite', m.created_at, u.username, NULL, NULL, g.name, m.status = 'member'
            FROM group_members m JOIN groups g ON g.id = m.group_id JOIN users u ON u.id = m.invited_by
            WHERE m.user_id = %(me)s AND m.created_at > %(since)s AND NOT u.frozen
            UNION ALL
            -- A venue I checked in at (or discovered) started a loyalty program (done: I joined it)
            SELECT 'loyalty', p.activated_at, NULL, v.id, v.name,
                   CASE WHEN p.kind = 'stamps' THEN p.stamps_required || ' damga = ' || p.reward
                        ELSE p.price || ' ₺/ay · ' || p.perk END,
                   EXISTS (SELECT 1 FROM loyalty_members m WHERE m.venue_id = p.venue_id AND m.user_id = %(me)s)
            FROM loyalty_programs p JOIN venues v ON v.id = p.venue_id
            WHERE p.active AND p.activated_at > %(since)s
              AND EXISTS (SELECT 1 FROM checkins c WHERE c.venue_id = p.venue_id AND c.user_id = %(me)s)
        ) items
        WHERE %(cleared)s::timestamptz IS NULL OR at > %(cleared)s
        ORDER BY at DESC LIMIT 100
        """,
        {"me": me["id"], "since": now - timedelta(days=NOTIFICATION_DAYS), "cleared": _cleared_at(conn, me["id"])},
    ).fetchall()
    dismissed = {r["key"] for r in conn.execute("SELECT key FROM notification_dismissals WHERE user_id = %s", (me["id"],))}
    items = [{**r, "key": notification_key(r)} for r in rows]
    return [i for i in items if i["key"] not in dismissed][:50]


def notification_key(item: dict) -> str:
    """Names one 🔔 item, for deleting it: what, where, who and when (to the microsecond)."""
    at = item["at"]
    return f"{item['kind']}:{item['venue_id'] or ''}:{item['username'] or ''}:{round(at.timestamp() * 1_000_000)}"


def _cleared_at(conn: psycopg.Connection, user_id: int) -> datetime | None:
    return conn.execute("SELECT notifications_cleared_at AS at FROM users WHERE id = %s", (user_id,)).fetchone()["at"]


def dismiss_notification(conn: psycopg.Connection, me: dict, key: str) -> None:
    conn.execute(
        "INSERT INTO notification_dismissals (user_id, key) VALUES (%s, %s) ON CONFLICT DO NOTHING", (me["id"], key[:200])
    )


def clear_notifications(conn: psycopg.Connection, me: dict, now: datetime) -> None:
    """"Temizle": everything so far goes; the one-by-one deletions are not needed any more."""
    conn.execute("UPDATE users SET notifications_cleared_at = %s WHERE id = %s", (now, me["id"]))
    conn.execute("DELETE FROM notification_dismissals WHERE user_id = %s", (me["id"],))
