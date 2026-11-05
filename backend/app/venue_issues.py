"""v2 "Bilgi yanlış mı?": users report wrong venue info; 3 people reporting the same thing put the
venue on the admin's "Kontrol edilecek" list (Daha fazla > Yönetici), where it is closed, fixed or dismissed."""
from datetime import datetime

import psycopg

from app.moderation import ModerationError, require_admin

KINDS = ("closed", "hours", "location", "name", "offensive_name")
NEEDED = 3  # different people reporting the same thing
MAX_FOUNDERS = 10
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
    if kind == "offensive_name":
        _hide_if_reported(conn, venue_id, now)


def _hide_if_reported(conn: psycopg.Connection, venue_id: int, now: datetime) -> None:
    """"Uygunsuz ad" from 3 registered people: a venue a user added stays hidden until an admin looks.
    Not the imported venues: a rival with three accounts must not be able to take a real place off the map."""
    conn.execute(
        """
        UPDATE venues SET hidden_at = %(now)s
        WHERE id = %(venue)s AND source = 'user' AND hidden_at IS NULL AND (
            SELECT count(*) FROM venue_issues i JOIN users u ON u.id = i.user_id
            WHERE i.venue_id = %(venue)s AND i.kind = 'offensive_name' AND i.resolved_at IS NULL AND NOT u.is_guest
        ) >= %(needed)s
        """,
        {"now": now, "venue": venue_id, "needed": NEEDED},
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
    if kind == "offensive_name":
        conn.execute("UPDATE venues SET hidden_at = NULL WHERE id = %s", (venue_id,))
    conn.execute(
        "UPDATE venue_issues SET resolved_at = %s WHERE venue_id = %s AND kind = %s AND resolved_at IS NULL",
        (now, venue_id, kind),
    )


def set_founder(conn: psycopg.Connection, user: dict, venue_id: int, founder: bool) -> None:
    """"Kurucu mekan": set by an admin, for at most MAX_FOUNDERS venues."""
    require_admin(user)
    if conn.execute("SELECT 1 FROM venues WHERE id = %s", (venue_id,)).fetchone() is None:
        raise ModerationError("Mekan bulunamadı.", 404)
    if founder:
        others = conn.execute(
            "SELECT count(*)::int AS n FROM venue_profiles WHERE founder AND venue_id <> %s", (venue_id,)
        ).fetchone()["n"]
        if others >= MAX_FOUNDERS:
            raise ModerationError(f"En fazla {MAX_FOUNDERS} kurucu mekan olabilir.", 409)
    conn.execute(
        """
        INSERT INTO venue_profiles (venue_id, founder) VALUES (%s, %s)
        ON CONFLICT (venue_id) DO UPDATE SET founder = EXCLUDED.founder
        """,
        (venue_id, founder),
    )


def pending_venues(conn: psycopg.Connection, user: dict) -> list[dict]:
    """Venues users added, waiting for approval: already visible to everyone, newest first."""
    require_admin(user)
    return conn.execute(
        """
        SELECT v.id, v.name, v.district, a.username AS added_by, v.created_at,
               (SELECT count(*) FROM checkins c WHERE c.venue_id = v.id)::int AS checkins
        FROM venues v LEFT JOIN users a ON a.id = v.added_by
        WHERE v.source = 'user' AND v.approved_at IS NULL AND v.closed_at IS NULL
          AND v.created_at > now() - interval '30 days'
        ORDER BY v.created_at DESC LIMIT 200
        """
    ).fetchall()


def moderate_pending(conn: psycopg.Connection, user: dict, venue_id: int, action: str, name: str | None, now: datetime) -> None:
    """rename: the admin corrects the name. remove: off the map (the row and its check-ins stay)."""
    require_admin(user)
    clean = " ".join((name or "").split())
    if action == "rename" and not clean:
        raise ModerationError("Adı yaz.")
    done = conn.execute(
        "UPDATE venues SET name = %s WHERE id = %s AND source = 'user' RETURNING id" if action == "rename"
        else "UPDATE venues SET closed_at = %s WHERE id = %s AND source = 'user' RETURNING id",
        (clean if action == "rename" else now, venue_id),
    ).fetchone()
    if done is None:
        raise ModerationError("Mekan bulunamadı.", 404)
