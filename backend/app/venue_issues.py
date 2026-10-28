"""v2 "Bilgi yanlış mı?": users report wrong venue info; 3 people reporting the same thing put the
venue on the admin's "Kontrol edilecek" list (Daha fazla > Yönetici), where it is closed, fixed or dismissed."""
from datetime import datetime

import psycopg

from app.moderation import ModerationError, require_admin

KINDS = ("closed", "hours", "location", "name")
NEEDED = 3  # different people reporting the same thing
MAX_NOTE = 200


def report_issue(conn: psycopg.Connection, user: dict, venue_id: int, kind: str, note: str | None, now: datetime) -> None:
    if kind not in KINDS:
        raise ModerationError("Bilinmeyen bildirim.", 422)
    if conn.execute("SELECT 1 FROM venues WHERE id = %s", (venue_id,)).fetchone() is None:
        raise ModerationError("Mekan bulunamadı.", 404)
    note = (note or "").strip()[:MAX_NOTE] or None
    conn.execute(
        """
        INSERT INTO venue_issues (venue_id, user_id, kind, note, created_at) VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (venue_id, user_id, kind) WHERE resolved_at IS NULL DO UPDATE SET note = COALESCE(EXCLUDED.note, venue_issues.note)
        """,
        (venue_id, user["id"], kind, note, now),
    )


def open_issues(conn: psycopg.Connection, user: dict) -> list[dict]:
    """Venues where at least 3 people reported the same thing, most reported first."""
    require_admin(user)
    return conn.execute(
        """
        SELECT v.id AS venue_id, v.name AS venue_name, v.district, v.open_hour, v.close_hour, i.kind,
               count(*)::int AS reports, array_remove(array_agg(i.note ORDER BY i.created_at DESC), NULL) AS notes,
               max(i.created_at) AS last_at
        FROM venue_issues i JOIN venues v ON v.id = i.venue_id
        WHERE i.resolved_at IS NULL AND v.closed_at IS NULL
        GROUP BY v.id, i.kind
        HAVING count(*) >= %s
        ORDER BY count(*) DESC, max(i.created_at) DESC
        LIMIT 200
        """,
        (NEEDED,),
    ).fetchall()


def resolve_issue(
    conn: psycopg.Connection,
    user: dict,
    venue_id: int,
    kind: str,
    action: str,
    now: datetime,
    name: str | None = None,
    open_hour: int | None = None,
    close_hour: int | None = None,
) -> None:
    """close: off the map for good (all its reports end). fixed: the name / hours given are saved.
    dismiss: the reports were wrong. Either way these reports leave the list."""
    require_admin(user)
    if conn.execute("SELECT 1 FROM venues WHERE id = %s", (venue_id,)).fetchone() is None:
        raise ModerationError("Mekan bulunamadı.", 404)
    if action == "close":
        conn.execute("UPDATE venues SET closed_at = %s WHERE id = %s", (now, venue_id))
        conn.execute("UPDATE venue_issues SET resolved_at = %s WHERE venue_id = %s AND resolved_at IS NULL", (now, venue_id))
        return
    if action == "fixed":
        if name is not None and name.strip():
            conn.execute("UPDATE venues SET name = %s WHERE id = %s", (name.strip()[:80], venue_id))
        if open_hour is not None and close_hour is not None:
            conn.execute("UPDATE venues SET open_hour = %s, close_hour = %s WHERE id = %s", (open_hour, close_hour, venue_id))
    conn.execute(
        "UPDATE venue_issues SET resolved_at = %s WHERE venue_id = %s AND kind = %s AND resolved_at IS NULL",
        (now, venue_id, kind),
    )
