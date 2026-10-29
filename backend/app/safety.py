"""v2: blocking, muting and reporting reviews, plus a person's profile.

Blocking ends the friendship, stops requests both ways and hides each other's
reviews and replies. Muting keeps the friendship but leaves the person out of
my feed. A reported review or reply is hidden at once for the reporter, and for
everyone after REPORTS_TO_HIDE reports (until someone reviews it).
"""
from dataclasses import dataclass
from datetime import datetime

import psycopg

from app.accounts import normalize_username
from app.checkins import user_stats

REPORTS_TO_HIDE = 3
REASONS = {"insult": "Hakaret / taciz", "spam": "Spam / reklam", "false": "Yanlış bilgi", "other": "Diğer"}

# SQL pieces: ids I should not see (I blocked them, they blocked me, or their account is frozen); ids I muted
BLOCKED = """(SELECT blocked_id FROM blocks WHERE blocker_id = %(me)s
              UNION SELECT blocker_id FROM blocks WHERE blocked_id = %(me)s
              UNION SELECT id FROM users WHERE frozen)"""
FROZEN = "(SELECT id FROM users WHERE frozen)"
MUTED = "(SELECT muted_id FROM mutes WHERE muter_id = %(me)s)"


def hidden_review(alias: str = "r") -> str:
    """Condition for a review row (`alias`) I should not see: removed by an admin, reported by me, or by
    too many (reports an admin dismissed do not count)."""
    return f"""({alias}.removed_at IS NOT NULL
              OR EXISTS (SELECT 1 FROM reports x WHERE x.review_id = {alias}.id AND x.reporter_id = %(me)s AND x.dismissed_at IS NULL)
              OR (SELECT count(*) FROM reports x WHERE x.review_id = {alias}.id AND x.dismissed_at IS NULL) >= {REPORTS_TO_HIDE})"""


def hidden_reply(alias: str = "p") -> str:
    return f"""({alias}.removed_at IS NOT NULL
              OR EXISTS (SELECT 1 FROM reports x WHERE x.reply_id = {alias}.id AND x.reporter_id = %(me)s AND x.dismissed_at IS NULL)
              OR (SELECT count(*) FROM reports x WHERE x.reply_id = {alias}.id AND x.dismissed_at IS NULL) >= {REPORTS_TO_HIDE})"""


@dataclass
class SafetyError(Exception):
    message: str
    status: int = 400


def _person(conn: psycopg.Connection, me: dict, username: str) -> dict:
    other = conn.execute(
        "SELECT id, username, share_checkins FROM users WHERE lower(username) = %s AND NOT is_guest",
        (normalize_username(username),),
    ).fetchone()
    if other is None:
        raise SafetyError("Bu kullanıcı adıyla kimse yok.", 404)
    if other["id"] == me["id"]:
        raise SafetyError("Bunu kendine yapamazsın.")
    return other


def is_blocked_between(conn: psycopg.Connection, a: int, b: int) -> bool:
    return conn.execute(
        "SELECT 1 FROM blocks WHERE (blocker_id = %s AND blocked_id = %s) OR (blocker_id = %s AND blocked_id = %s)",
        (a, b, b, a),
    ).fetchone() is not None


def block(conn: psycopg.Connection, me: dict, username: str) -> None:
    other = _person(conn, me, username)
    conn.execute(
        """
        DELETE FROM friendships
        WHERE (requester_id = %(a)s AND addressee_id = %(b)s) OR (requester_id = %(b)s AND addressee_id = %(a)s)
        """,
        {"a": me["id"], "b": other["id"]},
    )
    conn.execute("DELETE FROM mutes WHERE muter_id = %s AND muted_id = %s", (me["id"], other["id"]))
    conn.execute("INSERT INTO blocks (blocker_id, blocked_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (me["id"], other["id"]))


def unblock(conn: psycopg.Connection, me: dict, username: str) -> None:
    other = _person(conn, me, username)
    conn.execute("DELETE FROM blocks WHERE blocker_id = %s AND blocked_id = %s", (me["id"], other["id"]))


def mute(conn: psycopg.Connection, me: dict, username: str, on: bool) -> None:
    other = _person(conn, me, username)
    if on:
        conn.execute("INSERT INTO mutes (muter_id, muted_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (me["id"], other["id"]))
    else:
        conn.execute("DELETE FROM mutes WHERE muter_id = %s AND muted_id = %s", (me["id"], other["id"]))


def blocked_people(conn: psycopg.Connection, me: dict) -> list[dict]:
    """People I blocked (Gizlilik > Engellenenler)."""
    return conn.execute(
        """
        SELECT u.username, b.created_at FROM blocks b JOIN users u ON u.id = b.blocked_id
        WHERE b.blocker_id = %s ORDER BY lower(u.username)
        """,
        (me["id"],),
    ).fetchall()


def report(conn: psycopg.Connection, me: dict, reason: str, review_id: int | None = None, reply_id: int | None = None) -> None:
    if me["is_guest"]:
        raise SafetyError("Şikâyet etmek için kayıt ol.", 403)
    if reason not in REASONS:
        raise SafetyError("Bir şikâyet nedeni seç.")
    table, item_id = ("reviews", review_id) if review_id is not None else ("review_replies", reply_id)
    owner = conn.execute(f"SELECT user_id FROM {table} WHERE id = %s", (item_id,)).fetchone()
    if owner is None:
        raise SafetyError("Bulunamadı.", 404)
    if owner["user_id"] == me["id"]:
        raise SafetyError("Kendi yazdığını şikâyet edemezsin.")
    conn.execute(
        "INSERT INTO reports (reporter_id, review_id, reply_id, reason) VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING",
        (me["id"], review_id, reply_id, reason),
    )


def profile(conn: psycopg.Connection, me: dict, username: str, now: datetime) -> dict:
    """A person's profile: stats, earned badges, and (for me and my friends) the venues they checked in at."""
    other = conn.execute(
        "SELECT id, username, share_checkins, frozen, stats_visibility FROM users WHERE lower(username) = %s AND NOT is_guest",
        (normalize_username(username),),
    ).fetchone()
    hidden = other is not None and other["id"] != me["id"] and (other["frozen"] or is_blocked_between(conn, me["id"], other["id"]))
    if other is None or hidden:
        raise SafetyError("Bu kullanıcı adıyla kimse yok.", 404)
    is_me = other["id"] == me["id"]
    from app.friends import relation
    from app.streaks import weekly_streak
    from app.user_photos import photo_time

    rel = "self" if is_me else relation(conn, me["id"], other["id"])
    # Statistics: for friends (default) or only for the person (Gizlilik ayarları)
    show_stats = is_me or (other["stats_visibility"] == "friends" and rel == "friend")
    stats = user_stats(conn, other["id"]) if show_stats else None
    # Others see only public check-ins, and only friends who share them
    show_venues = is_me or (rel == "friend" and other["share_checkins"])
    venues = (
        conn.execute(
            """
            SELECT v.id AS venue_id, v.name AS venue_name, v.category, count(*)::int AS visits,
                   max(c.created_at) AS last_at, bool_or(c.is_first) AS discovered
            FROM checkins c JOIN venues v ON v.id = c.venue_id
            WHERE c.user_id = %s AND NOT c.is_demo AND (%s OR NOT c.is_private)
            GROUP BY v.id, v.name, v.category ORDER BY max(c.created_at) DESC LIMIT 100
            """,
            (other["id"], is_me),
        ).fetchall()
        if show_venues
        else None
    )
    muted = not is_me and conn.execute(
        "SELECT 1 FROM mutes WHERE muter_id = %s AND muted_id = %s", (me["id"], other["id"])
    ).fetchone() is not None
    return {
        "id": other["id"],
        "username": other["username"],
        "relation": rel,
        "muted": muted,
        "points": stats["points"] if stats else None,
        "checkins": stats["checkins"] if stats else None,
        "discoveries": stats["discoveries"] if stats else None,
        "badges": stats["badges"] if stats else [],
        "venues": venues,
        "weekly_streak": weekly_streak(conn, other["id"], now) if stats else None,
        "stats_hidden": stats is None,
        "level": stats["level"] if stats else _level(conn, other["id"]),
        "photo_at": photo_time(conn, other["id"]),
    }


def _level(conn: psycopg.Connection, user_id: int) -> dict:
    """The level without the rest of the statistics (they may be hidden; the level is a status)."""
    from app.levels import user_level

    level = user_level(conn, user_id)
    return {**level, "next": None}
