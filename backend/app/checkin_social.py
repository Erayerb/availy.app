"""v2: friends' likes and comments on a check-in.

Only the owner and their friends see a check-in (public ones, when the owner shares check-ins);
the same people may like it and comment on it.
"""
from datetime import datetime

import psycopg

from app.safety import BLOCKED, is_blocked_between

MAX_TEXT = 280
MAX_COMMENTS_PER_PERSON = 5


class SocialError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def _clean(text: str) -> str:
    body = " ".join(text.split())
    if len(body) > MAX_TEXT:
        raise SocialError(f"En fazla {MAX_TEXT} karakter yazabilirsin.")
    return body


def _visible_checkin(conn: psycopg.Connection, me: dict, checkin_id: int) -> dict:
    """The check-in if `me` may see it (the owner, or a friend when it is public and shared)."""
    row = conn.execute(
        """
        SELECT c.id, c.user_id, c.is_private, u.share_checkins, u.frozen
        FROM checkins c JOIN users u ON u.id = c.user_id WHERE c.id = %s
        """,
        (checkin_id,),
    ).fetchone()
    if row is None:
        raise SocialError("Check-in bulunamadı.", 404)
    if row["user_id"] == me["id"]:
        return row
    from app.friends import relation

    if (
        row["is_private"]
        or not row["share_checkins"]
        or row["frozen"]
        or is_blocked_between(conn, me["id"], row["user_id"])
        or relation(conn, me["id"], row["user_id"]) != "friend"
    ):
        raise SocialError("Check-in bulunamadı.", 404)
    return row


def like(conn: psycopg.Connection, me: dict, checkin_id: int, liked: bool, now: datetime) -> None:
    _visible_checkin(conn, me, checkin_id)
    if liked:
        conn.execute(
            "INSERT INTO checkin_likes (checkin_id, user_id, created_at) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
            (checkin_id, me["id"], now),
        )
    else:
        conn.execute("DELETE FROM checkin_likes WHERE checkin_id = %s AND user_id = %s", (checkin_id, me["id"]))


def comment(conn: psycopg.Connection, me: dict, checkin_id: int, body: str, now: datetime) -> dict:
    if me.get("is_guest"):
        raise SocialError("Yorum yazmak için kayıt ol.", 403)
    _visible_checkin(conn, me, checkin_id)
    text = _clean(body)
    if not text:
        raise SocialError("Yorum boş olamaz.")
    written = conn.execute(
        "SELECT count(*)::int AS n FROM checkin_comments WHERE checkin_id = %s AND user_id = %s", (checkin_id, me["id"])
    ).fetchone()["n"]
    if written >= MAX_COMMENTS_PER_PERSON:
        raise SocialError(f"Bir check-in'e en fazla {MAX_COMMENTS_PER_PERSON} yorum yazabilirsin.", 409)
    return conn.execute(
        "INSERT INTO checkin_comments (checkin_id, user_id, body, created_at) VALUES (%s, %s, %s, %s) RETURNING id",
        (checkin_id, me["id"], text, now),
    ).fetchone()


def delete_comment(conn: psycopg.Connection, me: dict, comment_id: int) -> None:
    """My own comment, or any comment on my check-in."""
    conn.execute(
        """
        DELETE FROM checkin_comments k USING checkins c
        WHERE k.id = %s AND c.id = k.checkin_id AND (k.user_id = %s OR c.user_id = %s)
        """,
        (comment_id, me["id"], me["id"]),
    )


def social_for(conn: psycopg.Connection, me: dict, checkin_ids: list[int]) -> dict[int, dict]:
    """Likes (count, mine, the last 3 who liked) and comments (oldest first) of these check-ins, for the feed."""
    if not checkin_ids:
        return {}
    params = {"ids": checkin_ids, "me": me["id"]}
    out = {cid: {"likes": 0, "liked": False, "likers": [], "comments": []} for cid in checkin_ids}
    for r in conn.execute(
        f"""
        SELECT l.checkin_id, count(*)::int AS likes, bool_or(l.user_id = %(me)s) AS liked,
               (array_agg(u.username ORDER BY l.created_at DESC))[1:3] AS likers
        FROM checkin_likes l JOIN users u ON u.id = l.user_id
        WHERE l.checkin_id = ANY(%(ids)s) AND l.user_id NOT IN {BLOCKED} GROUP BY l.checkin_id
        """,
        params,
    ).fetchall():
        out[r["checkin_id"]].update(likes=r["likes"], liked=r["liked"], likers=r["likers"])
    for r in conn.execute(
        f"""
        SELECT k.id, k.checkin_id, u.username, k.body, k.created_at AS at, k.user_id = %(me)s AS mine
        FROM checkin_comments k JOIN users u ON u.id = k.user_id
        WHERE k.checkin_id = ANY(%(ids)s) AND k.user_id NOT IN {BLOCKED} ORDER BY k.created_at
        """,
        params,
    ).fetchall():
        out[r.pop("checkin_id")]["comments"].append(r)
    return out
