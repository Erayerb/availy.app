"""v2 moderation (Daha fazla > Yönetici): reported reviews and replies, removed or kept by an admin.

A business cannot delete its customers' reviews (a venue that could would not be trusted); it reports
them, and its reports come first in the admin's list. Admins are set by hand (users.is_admin).
"""
from datetime import datetime

import psycopg


class ModerationError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def require_admin(user: dict) -> None:
    if not user.get("is_admin"):
        raise ModerationError("Bu sayfa yalnızca yöneticiler içindir.", 403)


def reported_items(conn: psycopg.Connection, user: dict) -> list[dict]:
    """Reviews and replies with open reports (not removed, reports not dismissed): the venue's
    business first, then the most reported."""
    require_admin(user)
    return conn.execute(
        """
        SELECT * FROM (
            SELECT 'review' AS kind, r.id, r.body, r.rating, a.username AS author, v.name AS venue_name, v.id AS venue_id,
                   count(x.*)::int AS reports, array_agg(DISTINCT x.reason) AS reasons, max(x.created_at) AS last_at,
                   bool_or(ru.role = 'business' AND ru.venue_id = r.venue_id) AS from_business
            FROM reports x JOIN reviews r ON r.id = x.review_id JOIN venues v ON v.id = r.venue_id
            JOIN users ru ON ru.id = x.reporter_id LEFT JOIN users a ON a.id = r.user_id
            WHERE x.dismissed_at IS NULL AND r.removed_at IS NULL
            GROUP BY r.id, a.username, v.name, v.id
            UNION ALL
            SELECT 'reply', p.id, p.body, NULL, a.username, v.name, v.id,
                   count(x.*)::int, array_agg(DISTINCT x.reason), max(x.created_at),
                   bool_or(ru.role = 'business' AND ru.venue_id = r.venue_id)
            FROM reports x JOIN review_replies p ON p.id = x.reply_id JOIN reviews r ON r.id = p.review_id
            JOIN venues v ON v.id = r.venue_id JOIN users ru ON ru.id = x.reporter_id LEFT JOIN users a ON a.id = p.user_id
            WHERE x.dismissed_at IS NULL AND p.removed_at IS NULL
            GROUP BY p.id, a.username, v.name, v.id
        ) items
        ORDER BY from_business DESC, reports DESC, last_at DESC
        LIMIT 200
        """
    ).fetchall()


def _table(kind: str) -> tuple[str, str]:
    if kind == "review":
        return "reviews", "review_id"
    if kind == "reply":
        return "review_replies", "reply_id"
    raise ModerationError("Bilinmeyen içerik.", 404)


def remove_item(conn: psycopg.Connection, user: dict, kind: str, item_id: int, now: datetime) -> None:
    """Gone for everyone (kept in the database with removed_at, for the record)."""
    require_admin(user)
    table, _ = _table(kind)
    if conn.execute(f"UPDATE {table} SET removed_at = %s WHERE id = %s RETURNING 1", (now, item_id)).fetchone() is None:
        raise ModerationError("Bulunamadı.", 404)


def dismiss_reports(conn: psycopg.Connection, user: dict, kind: str, item_id: int, now: datetime) -> None:
    """The reports were unfounded: they no longer hide it, and it leaves the list."""
    require_admin(user)
    _, column = _table(kind)
    conn.execute(f"UPDATE reports SET dismissed_at = %s WHERE {column} = %s AND dismissed_at IS NULL", (now, item_id))
