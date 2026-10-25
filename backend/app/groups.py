"""v2 groups ("Grup oluştur"): a few people with their own ranking (Sosyal > Sıralama > Gruplar).

The creator names the group and invites friends or people around (the ones availy suggests);
an invited person joins with "Katıl". Anyone in the group may invite more people.
"""
from datetime import datetime

import psycopg

from app.accounts import normalize_username
from app.safety import BLOCKED

MAX_NAME = 40
MAX_MEMBERS = 50
MAX_GROUPS = 20  # groups one person may be in (or invited to)


class GroupError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def _require_person(me: dict) -> None:
    if me["is_guest"] or me.get("role") == "business":
        raise GroupError("Grup için bireysel bir hesapla kayıt ol.", 403)


def _membership(conn: psycopg.Connection, group_id: int, user_id: int) -> str | None:
    row = conn.execute("SELECT status FROM group_members WHERE group_id = %s AND user_id = %s", (group_id, user_id)).fetchone()
    return row["status"] if row else None


def _invite(conn: psycopg.Connection, me: dict, group_id: int, usernames: list[str], now: datetime) -> list[str]:
    """Invites the people who may be invited (friends, or people who can be found or suggested); returns them."""
    names = sorted({normalize_username(u) for u in usernames if u.strip()})
    if not names:
        return []
    size = conn.execute("SELECT count(*)::int AS n FROM group_members WHERE group_id = %s", (group_id,)).fetchone()["n"]
    if size + len(names) > MAX_MEMBERS:
        raise GroupError(f"Bir grupta en fazla {MAX_MEMBERS} kişi olabilir.")
    people = conn.execute(
        f"""
        SELECT u.id, u.username FROM users u
        WHERE lower(u.username) = ANY(%(names)s) AND u.id <> %(me)s AND NOT u.is_guest AND u.role = 'personal'
          AND NOT u.frozen AND u.id NOT IN {BLOCKED}
          AND (u.searchable OR u.suggest_by_venues OR u.id IN (
                SELECT addressee_id FROM friendships WHERE requester_id = %(me)s AND status = 'accepted'
                UNION SELECT requester_id FROM friendships WHERE addressee_id = %(me)s AND status = 'accepted'))
          AND (SELECT count(*) FROM group_members m WHERE m.user_id = u.id) < %(max)s
        """,
        {"names": names, "me": me["id"], "max": MAX_GROUPS},
    ).fetchall()
    for p in people:
        conn.execute(
            """
            INSERT INTO group_members (group_id, user_id, status, invited_by, created_at)
            VALUES (%s, %s, 'invited', %s, %s) ON CONFLICT DO NOTHING
            """,
            (group_id, p["id"], me["id"], now),
        )
    return [p["username"] for p in people]


def create_group(conn: psycopg.Connection, me: dict, name: str, usernames: list[str], now: datetime) -> dict:
    _require_person(me)
    clean = " ".join(name.split())
    if not clean:
        raise GroupError("Gruba bir ad ver.")
    if len(clean) > MAX_NAME:
        raise GroupError(f"Grup adı en fazla {MAX_NAME} karakter olabilir.")
    mine = conn.execute("SELECT count(*)::int AS n FROM group_members WHERE user_id = %s", (me["id"],)).fetchone()["n"]
    if mine >= MAX_GROUPS:
        raise GroupError(f"En fazla {MAX_GROUPS} grupta olabilirsin.", 409)
    group = conn.execute(
        "INSERT INTO groups (name, owner_id, created_at) VALUES (%s, %s, %s) RETURNING id", (clean, me["id"], now)
    ).fetchone()
    conn.execute(
        "INSERT INTO group_members (group_id, user_id, status, created_at) VALUES (%s, %s, 'member', %s)",
        (group["id"], me["id"], now),
    )
    invited = _invite(conn, me, group["id"], usernames, now)
    return {"id": group["id"], "invited": invited}


def invite(conn: psycopg.Connection, me: dict, group_id: int, usernames: list[str], now: datetime) -> list[str]:
    if _membership(conn, group_id, me["id"]) != "member":
        raise GroupError("Grup bulunamadı.", 404)
    return _invite(conn, me, group_id, usernames, now)


def join(conn: psycopg.Connection, me: dict, group_id: int) -> None:
    if conn.execute(
        "UPDATE group_members SET status = 'member' WHERE group_id = %s AND user_id = %s RETURNING 1", (group_id, me["id"])
    ).fetchone() is None:
        raise GroupError("Davet bulunamadı.", 404)


def leave(conn: psycopg.Connection, me: dict, group_id: int) -> None:
    """Leaving (or turning an invite down). The last member's leaving deletes the group."""
    conn.execute("DELETE FROM group_members WHERE group_id = %s AND user_id = %s", (group_id, me["id"]))
    if conn.execute("SELECT 1 FROM group_members WHERE group_id = %s AND status = 'member'", (group_id,)).fetchone() is None:
        conn.execute("DELETE FROM groups WHERE id = %s", (group_id,))


def my_groups(conn: psycopg.Connection, me: dict) -> list[dict]:
    """Groups I am in, and the ones I am invited to (by whom)."""
    return conn.execute(
        """
        SELECT g.id, g.name, m.status, i.username AS invited_by,
               (SELECT count(*) FROM group_members x WHERE x.group_id = g.id AND x.status = 'member')::int AS members
        FROM group_members m JOIN groups g ON g.id = m.group_id LEFT JOIN users i ON i.id = m.invited_by
        WHERE m.user_id = %s
        ORDER BY m.status = 'invited' DESC, lower(g.name)
        """,
        (me["id"],),
    ).fetchall()


def is_member(conn: psycopg.Connection, group_id: int, user_id: int) -> bool:
    return _membership(conn, group_id, user_id) == "member"
