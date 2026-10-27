"""v2 venue lists ("Kadıköy'de ders çalışılacak yerler"): Favoriler > Listelerim.

A list is private, seen by friends, or seen by anyone with its link (share_code). Someone who
can see a list may save a copy of it ("Listeyi kaydet").
"""
import secrets
from datetime import datetime

import psycopg

from app.safety import BLOCKED

MAX_NAME = 40
MAX_LISTS = 30
MAX_ITEMS = 200
VISIBILITIES = ("private", "friends", "link")
# Share codes: easy to read out, no look-alike letters
CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY3479"


class ListError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def _new_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))


def _clean_name(name: str) -> str:
    clean = " ".join(name.split())
    if not clean:
        raise ListError("Listeye bir ad ver.")
    if len(clean) > MAX_NAME:
        raise ListError(f"Liste adı en fazla {MAX_NAME} karakter olabilir.")
    return clean


def _require_person(me: dict) -> None:
    if me["is_guest"]:
        raise ListError("Liste için kayıt ol.", 403)


LIST_FIELDS = """
    l.id, l.name, l.visibility, l.share_code, u.username AS owner, l.owner_id = %(me)s AS mine,
    COALESCE((SELECT array_agg(i.venue_id ORDER BY i.added_at DESC) FROM venue_list_items i WHERE i.list_id = l.id), '{}') AS venue_ids
"""


def my_lists(conn: psycopg.Connection, me: dict) -> list[dict]:
    return conn.execute(
        f"SELECT {LIST_FIELDS} FROM venue_lists l JOIN users u ON u.id = l.owner_id WHERE l.owner_id = %(me)s ORDER BY l.created_at",
        {"me": me["id"]},
    ).fetchall()


def create_list(conn: psycopg.Connection, me: dict, name: str, visibility: str, now: datetime, venue_ids: list[int] | None = None) -> dict:
    _require_person(me)
    if visibility not in VISIBILITIES:
        raise ListError("Görünürlük seç.")
    count = conn.execute("SELECT count(*)::int AS n FROM venue_lists WHERE owner_id = %s", (me["id"],)).fetchone()["n"]
    if count >= MAX_LISTS:
        raise ListError(f"En fazla {MAX_LISTS} liste oluşturabilirsin.", 409)
    row = conn.execute(
        "INSERT INTO venue_lists (owner_id, name, visibility, share_code, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (me["id"], _clean_name(name), visibility, _new_code(), now),
    ).fetchone()
    for venue_id in (venue_ids or [])[:MAX_ITEMS]:
        conn.execute(
            "INSERT INTO venue_list_items (list_id, venue_id, added_at) SELECT %s, id, %s FROM venues WHERE id = %s ON CONFLICT DO NOTHING",
            (row["id"], now, venue_id),
        )
    return get_list(conn, me, row["id"])


def _own(conn: psycopg.Connection, me: dict, list_id: int) -> None:
    if conn.execute("SELECT 1 FROM venue_lists WHERE id = %s AND owner_id = %s", (list_id, me["id"])).fetchone() is None:
        raise ListError("Liste bulunamadı.", 404)


def update_list(conn: psycopg.Connection, me: dict, list_id: int, name: str | None, visibility: str | None) -> dict:
    _own(conn, me, list_id)
    if visibility is not None and visibility not in VISIBILITIES:
        raise ListError("Görünürlük seç.")
    if name is not None:
        conn.execute("UPDATE venue_lists SET name = %s WHERE id = %s", (_clean_name(name), list_id))
    if visibility is not None:
        conn.execute("UPDATE venue_lists SET visibility = %s WHERE id = %s", (visibility, list_id))
    return get_list(conn, me, list_id)


def delete_list(conn: psycopg.Connection, me: dict, list_id: int) -> None:
    conn.execute("DELETE FROM venue_lists WHERE id = %s AND owner_id = %s", (list_id, me["id"]))


def set_item(conn: psycopg.Connection, me: dict, list_id: int, venue_id: int, present: bool, now: datetime) -> dict:
    _own(conn, me, list_id)
    if present:
        size = conn.execute("SELECT count(*)::int AS n FROM venue_list_items WHERE list_id = %s", (list_id,)).fetchone()["n"]
        if size >= MAX_ITEMS:
            raise ListError(f"Bir listede en fazla {MAX_ITEMS} mekan olabilir.", 409)
        if conn.execute(
            "INSERT INTO venue_list_items (list_id, venue_id, added_at) SELECT %s, id, %s FROM venues WHERE id = %s"
            " ON CONFLICT DO NOTHING RETURNING 1",
            (list_id, now, venue_id),
        ).fetchone() is None and conn.execute("SELECT 1 FROM venues WHERE id = %s", (venue_id,)).fetchone() is None:
            raise ListError("Mekan bulunamadı.", 404)
    else:
        conn.execute("DELETE FROM venue_list_items WHERE list_id = %s AND venue_id = %s", (list_id, venue_id))
    return get_list(conn, me, list_id)


def _visible(me_id: int) -> str:
    """SQL: the lists `me` may see: mine, friends' ("friends" or "link"), never a blocked person's."""
    return f"""(l.owner_id = {me_id} OR (l.visibility IN ('friends', 'link') AND l.owner_id NOT IN {BLOCKED} AND l.owner_id IN (
        SELECT addressee_id FROM friendships WHERE requester_id = %(me)s AND status = 'accepted'
        UNION SELECT requester_id FROM friendships WHERE addressee_id = %(me)s AND status = 'accepted')))"""


def get_list(conn: psycopg.Connection, me: dict, list_id: int, code: str | None = None) -> dict:
    """A list I may see: mine, a friend's, or (with its share code) one shared by link."""
    row = conn.execute(
        f"""
        SELECT {LIST_FIELDS} FROM venue_lists l JOIN users u ON u.id = l.owner_id
        WHERE l.id = %(id)s AND NOT u.frozen
          AND ({_visible(int(me["id"]))} OR (l.visibility = 'link' AND l.share_code = %(code)s AND l.owner_id NOT IN {BLOCKED}))
        """,
        {"id": list_id, "me": me["id"], "code": (code or "").upper()},
    ).fetchone()
    if row is None:
        raise ListError("Liste bulunamadı.", 404)
    return row


def list_by_code(conn: psycopg.Connection, me: dict, code: str) -> dict:
    row = conn.execute("SELECT id FROM venue_lists WHERE share_code = %s", (code.strip().upper(),)).fetchone()
    if row is None:
        raise ListError("Liste bulunamadı.", 404)
    return get_list(conn, me, row["id"], code)


def user_lists(conn: psycopg.Connection, me: dict, username: str) -> list[dict]:
    """A person's lists that I may see (Profil > Listeleri)."""
    return conn.execute(
        f"""
        SELECT {LIST_FIELDS} FROM venue_lists l JOIN users u ON u.id = l.owner_id
        WHERE lower(u.username) = lower(%(username)s) AND NOT u.frozen AND {_visible(int(me["id"]))}
          AND (l.owner_id = %(me)s OR l.visibility <> 'private')
        ORDER BY l.created_at
        """,
        {"username": username.lstrip("@"), "me": me["id"]},
    ).fetchall()


def save_copy(conn: psycopg.Connection, me: dict, list_id: int, code: str | None, now: datetime) -> dict:
    """"Listeyi kaydet": my own private copy of a list I can see."""
    source = get_list(conn, me, list_id, code)
    if source["mine"]:
        raise ListError("Bu zaten senin listen.")
    return create_list(conn, me, source["name"], "private", now, list(source["venue_ids"]))
