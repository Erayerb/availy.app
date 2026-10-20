"""v2 friends: find people by user name, send / accept requests.

Friends will see each other's (non-private) check-ins in a later version.
"""
from dataclasses import dataclass

import psycopg

from app.accounts import normalize_username

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
        """
        SELECT id, username, name FROM users
        WHERE NOT is_guest AND username IS NOT NULL AND id <> %s
          AND (lower(username) LIKE %s || '%%' OR lower(name) LIKE '%%' || %s || '%%')
        ORDER BY lower(username) LIMIT %s
        """,
        (me["id"], text, text, SEARCH_LIMIT),
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
    current = relation(conn, me["id"], other["id"])
    if current == "incoming":
        conn.execute(
            "UPDATE friendships SET status = 'accepted' WHERE requester_id = %s AND addressee_id = %s",
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
        WHERE f.requester_id = %(me)s OR f.addressee_id = %(me)s
        ORDER BY lower(u.username)
        """,
        {"me": me["id"]},
    ).fetchall()
    person = lambda r: {"id": r["id"], "username": r["username"], "name": r["name"]}  # noqa: E731
    return {
        "friends": [person(r) for r in rows if r["status"] == "accepted"],
        "incoming": [person(r) for r in rows if r["status"] == "pending" and not r["mine"]],
        "outgoing": [person(r) for r in rows if r["status"] == "pending" and r["mine"]],
    }
