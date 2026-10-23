"""v2 friends: find people by user name, send / accept requests.

Friends see each other's latest check-in (venue and time); private ones are never shown.
There is no live location: only places someone checked in at.
"""
from dataclasses import dataclass
from datetime import timedelta

import psycopg

from app.accounts import normalize_username
from app.safety import BLOCKED

SEARCH_LIMIT = 20


@dataclass
class FriendError(Exception):
    message: str
    status: int = 400


def require_registered(user: dict) -> None:
    if user["is_guest"]:
        raise FriendError("Arkadaş eklemek için kayıt ol.", 403)


def relation(conn: psycopg.Connection, me: int, other: int) -> str:
    """'friend', 'outgoing' (I asked), 'incoming' (they asked) or 'none'."""
    row = conn.execute(
        """
        SELECT requester_id, status FROM friendships
        WHERE (requester_id = %(a)s AND addressee_id = %(b)s) OR (requester_id = %(b)s AND addressee_id = %(a)s)
        """,
        {"a": me, "b": other},
    ).fetchone()
    if row is None:
        return "none"
    if row["status"] == "accepted":
        return "friend"
    return "outgoing" if row["requester_id"] == me else "incoming"


def search_users(conn: psycopg.Connection, me: dict, query: str) -> list[dict]:
    """Registered people whose user name starts with `query` (also matches the name)."""
    text = normalize_username(query)
    if len(text) < 2:
        return []
    rows = conn.execute(
        f"""
        SELECT id, username, name FROM users
        WHERE NOT is_guest AND role = 'personal' AND username IS NOT NULL AND id <> %(me)s AND searchable AND id NOT IN {BLOCKED}
          AND (lower(username) LIKE %(text)s || '%%' OR lower(name) LIKE '%%' || %(text)s || '%%')
        ORDER BY lower(username) LIMIT %(limit)s
        """,
        {"me": me["id"], "text": text, "limit": SEARCH_LIMIT},
    ).fetchall()
    return [{**r, "relation": relation(conn, me["id"], r["id"])} for r in rows]


def user_by_username(conn: psycopg.Connection, username: str) -> dict | None:
    return conn.execute(
        "SELECT id, username, name FROM users WHERE lower(username) = %s AND NOT is_guest",
        (normalize_username(username),),
    ).fetchone()


def add_friend(conn: psycopg.Connection, me: dict, username: str) -> dict:
    """Send a request, or accept theirs if they already asked. Returns the other person and the relation."""
    require_registered(me)
    other = user_by_username(conn, username)
    if other is None:
        raise FriendError("Bu kullanıcı adıyla kimse yok.", 404)
    if other["id"] == me["id"]:
        raise FriendError("Kendini arkadaş olarak ekleyemezsin.")
    from app.safety import is_blocked_between

    if conn.execute("SELECT 1 FROM blocks WHERE blocker_id = %s AND blocked_id = %s", (me["id"], other["id"])).fetchone():
        raise FriendError("Bu kişiyi engelledin. Önce profilinden engeli kaldır.", 403)
    # Blocked by them: answer as if the name did not exist
    if is_blocked_between(conn, me["id"], other["id"]):
        raise FriendError("Bu kullanıcı adıyla kimse yok.", 404)
    current = relation(conn, me["id"], other["id"])
    if current == "incoming":
        conn.execute(
            "UPDATE friendships SET status = 'accepted', accepted_at = now() WHERE requester_id = %s AND addressee_id = %s",
            (other["id"], me["id"]),
        )
        current = "friend"
    elif current == "none":
        conn.execute("INSERT INTO friendships (requester_id, addressee_id) VALUES (%s, %s)", (me["id"], other["id"]))
        current = "outgoing"
    return {**other, "relation": current}


def remove_friend(conn: psycopg.Connection, me: dict, other_id: int) -> None:
    """Unfriend, decline a request or cancel my own request."""
    conn.execute(
        """
        DELETE FROM friendships
        WHERE (requester_id = %(a)s AND addressee_id = %(b)s) OR (requester_id = %(b)s AND addressee_id = %(a)s)
        """,
        {"a": me["id"], "b": other_id},
    )


def list_friends(conn: psycopg.Connection, me: dict) -> dict:
    rows = conn.execute(
        """
        SELECT u.id, u.username, u.name, f.status, f.requester_id = %(me)s AS mine
        FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id = %(me)s THEN f.addressee_id ELSE f.requester_id END
        WHERE (f.requester_id = %(me)s OR f.addressee_id = %(me)s) AND NOT u.frozen
        ORDER BY lower(u.username)
        """,
        {"me": me["id"]},
    ).fetchall()
    person = lambda r: {"id": r["id"], "username": r["username"], "name": r["name"]}  # noqa: E731
    friends = [person(r) for r in rows if r["status"] == "accepted"]
    latest = last_checkins(conn, [f["id"] for f in friends])
    return {
        "friends": [{**f, "last_checkin": latest.get(f["id"])} for f in friends],
        "incoming": [person(r) for r in rows if r["status"] == "pending" and not r["mine"]],
        "outgoing": [person(r) for r in rows if r["status"] == "pending" and r["mine"]],
    }


def last_checkins(conn: psycopg.Connection, user_ids: list[int]) -> dict[int, dict]:
    """Each person's newest public check-in: {user_id: {venue_id, venue_name, at, is_first, points}}."""
    if not user_ids:
        return {}
    rows = conn.execute(
        """
        SELECT DISTINCT ON (c.user_id) c.user_id, c.venue_id, v.name AS venue_name, c.created_at AS at, c.is_first,
               (SELECT COALESCE(sum(p.amount), 0) FROM points p WHERE p.checkin_id = c.id)::int AS points
        FROM checkins c JOIN venues v ON v.id = c.venue_id JOIN users u ON u.id = c.user_id
        WHERE c.user_id = ANY(%s) AND NOT c.is_private AND NOT c.is_demo AND u.share_checkins
        ORDER BY c.user_id, c.created_at DESC
        """,
        (user_ids,),
    ).fetchall()
    return {r.pop("user_id"): r for r in rows}


INVITE_POINTS = 50
MAX_INVITE_REWARDS_PER_MONTH = 5  # fake sign-ups for points stay worthless


def accept_invite(conn: psycopg.Connection, newcomer: dict, inviter_username: str | None, now) -> bool:
    """Signed up through someone's invite link: friends right away, and the inviter earns points."""
    if not inviter_username or newcomer.get("role") != "personal":
        return False
    inviter = conn.execute(
        "SELECT id FROM users WHERE lower(username) = %s AND role = 'personal' AND NOT is_guest AND NOT frozen",
        (normalize_username(inviter_username),),
    ).fetchone()
    if inviter is None or inviter["id"] == newcomer["id"]:
        return False
    conn.execute("UPDATE users SET invited_by = %s WHERE id = %s AND invited_by IS NULL", (inviter["id"], newcomer["id"]))
    conn.execute(
        """
        INSERT INTO friendships (requester_id, addressee_id, status, accepted_at) VALUES (%s, %s, 'accepted', %s)
        ON CONFLICT DO NOTHING
        """,
        (inviter["id"], newcomer["id"], now),
    )
    rewarded = conn.execute(
        "SELECT count(*)::int AS n FROM points WHERE user_id = %s AND reason = 'invite' AND created_at > %s",
        (inviter["id"], now - timedelta(days=30)),
    ).fetchone()["n"]
    if rewarded < MAX_INVITE_REWARDS_PER_MONTH:
        conn.execute(
            "INSERT INTO points (user_id, amount, reason, created_at) VALUES (%s, %s, 'invite', %s)",
            (inviter["id"], INVITE_POINTS, now),
        )
    return True


HERE_WINDOW = timedelta(minutes=60)


def friends_here(conn: psycopg.Connection, me: dict, venue_id: int, now) -> list[dict]:
    """"Arkadaşların burada": friends whose latest public check-in at this venue is from the last hour."""
    return conn.execute(
        f"""
        SELECT u.username, max(c.created_at) AS at
        FROM checkins c JOIN users u ON u.id = c.user_id
        WHERE c.venue_id = %(venue)s AND NOT c.is_private AND NOT c.is_demo AND c.created_at > %(since)s
          AND u.share_checkins AND u.id NOT IN {BLOCKED}
          AND u.id IN (SELECT addressee_id FROM friendships WHERE requester_id = %(me)s AND status = 'accepted'
                       UNION SELECT requester_id FROM friendships WHERE addressee_id = %(me)s AND status = 'accepted')
        GROUP BY u.username ORDER BY max(c.created_at) DESC
        """,
        {"venue": venue_id, "since": now - HERE_WINDOW, "me": me["id"]},
    ).fetchall()
