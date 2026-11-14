"""Sponsorlu mekan: a venue shown first (on the home page, marked "Sponsorlu") for a paid period.

Until payments exist, a business asks for it and an admin switches it on for 7 or 30 days.
The card's views and taps are counted per day (no people), and shown to the business with the
check-ins made while it was sponsored.
"""
from datetime import datetime, timedelta

import psycopg

from app.moderation import require_admin

PERIODS = (7, 30)


class SponsorError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def active_sponsored(conn: psycopg.Connection, venue_ids: list[int], now: datetime) -> set[int]:
    if not venue_ids:
        return set()
    rows = conn.execute(
        "SELECT DISTINCT venue_id FROM sponsorships WHERE venue_id = ANY(%s) AND starts_at <= %s AND ends_at > %s",
        (venue_ids, now, now),
    ).fetchall()
    return {r["venue_id"] for r in rows}


def count_event(conn: psycopg.Connection, venue_id: int, kind: str, now: datetime) -> None:
    """A view or a tap on a sponsored card; only counted while the venue is sponsored."""
    if kind not in ("view", "tap") or venue_id not in active_sponsored(conn, [venue_id], now):
        return
    conn.execute(
        """
        INSERT INTO sponsor_events (venue_id, kind, day, count) VALUES (%s, %s, %s, 1)
        ON CONFLICT (venue_id, kind, day) DO UPDATE SET count = sponsor_events.count + 1
        """,
        (venue_id, kind, now.date()),
    )


def business_status(conn: psycopg.Connection, venue_id: int, now: datetime) -> dict:
    """The business's own view: running now, asked, and the last 30 days' numbers."""
    active = conn.execute(
        "SELECT starts_at, ends_at FROM sponsorships WHERE venue_id = %s AND ends_at > %s ORDER BY ends_at DESC LIMIT 1",
        (venue_id, now),
    ).fetchone()
    request = conn.execute("SELECT days, created_at FROM sponsor_requests WHERE venue_id = %s", (venue_id,)).fetchone()
    since = now - timedelta(days=30)
    counts = {
        r["kind"]: r["n"]
        for r in conn.execute(
            "SELECT kind, sum(count)::int AS n FROM sponsor_events WHERE venue_id = %s AND day >= %s GROUP BY kind",
            (venue_id, since.date()),
        ).fetchall()
    }
    checkins = conn.execute(
        """
        SELECT count(*)::int AS n FROM checkins c
        WHERE c.venue_id = %s AND c.created_at > %s AND NOT c.is_demo
          AND EXISTS (SELECT 1 FROM sponsorships s WHERE s.venue_id = c.venue_id
                      AND c.created_at >= s.starts_at AND c.created_at < s.ends_at)
        """,
        (venue_id, since),
    ).fetchone()["n"]
    return {
        "active": dict(active) if active else None,
        "requested_days": request["days"] if request and not active else None,
        "views": counts.get("view", 0),
        "taps": counts.get("tap", 0),
        "checkins": checkins,
    }


def request_sponsorship(conn: psycopg.Connection, user: dict, days: int) -> None:
    if user["role"] != "business" or not user.get("venue_id"):
        raise SponsorError("Önce mekanını seç.", 403)
    if days not in PERIODS:
        raise SponsorError("7 ya da 30 gün seç.")
    conn.execute(
        """
        INSERT INTO sponsor_requests (venue_id, user_id, days) VALUES (%s, %s, %s)
        ON CONFLICT (venue_id) DO UPDATE SET days = EXCLUDED.days, created_at = now(), user_id = EXCLUDED.user_id
        """,
        (user["venue_id"], user["id"], days),
    )


def admin_overview(conn: psycopg.Connection, admin: dict, now: datetime) -> dict:
    require_admin(admin)
    requests = conn.execute(
        """
        SELECT r.venue_id, v.name AS venue_name, r.days, r.created_at FROM sponsor_requests r
        JOIN venues v ON v.id = r.venue_id ORDER BY r.created_at
        """
    ).fetchall()
    active = conn.execute(
        """
        SELECT s.venue_id, v.name AS venue_name, s.ends_at FROM sponsorships s JOIN venues v ON v.id = s.venue_id
        WHERE s.ends_at > %s ORDER BY s.ends_at
        """,
        (now,),
    ).fetchall()
    return {"requests": requests, "active": active}


def start_sponsorship(conn: psycopg.Connection, admin: dict, venue_id: int, days: int, now: datetime) -> None:
    """Switch it on (a running one is lengthened); the venue's request is done."""
    require_admin(admin)
    if days not in PERIODS:
        raise SponsorError("7 ya da 30 gün seç.")
    running = conn.execute(
        "SELECT id, ends_at FROM sponsorships WHERE venue_id = %s AND ends_at > %s ORDER BY ends_at DESC LIMIT 1",
        (venue_id, now),
    ).fetchone()
    if running:
        conn.execute("UPDATE sponsorships SET ends_at = %s WHERE id = %s", (running["ends_at"] + timedelta(days=days), running["id"]))
    else:
        conn.execute(
            "INSERT INTO sponsorships (venue_id, starts_at, ends_at, created_by) VALUES (%s, %s, %s, %s)",
            (venue_id, now, now + timedelta(days=days), admin["id"]),
        )
    conn.execute("DELETE FROM sponsor_requests WHERE venue_id = %s", (venue_id,))


def stop_sponsorship(conn: psycopg.Connection, admin: dict, venue_id: int, now: datetime) -> None:
    require_admin(admin)
    conn.execute("UPDATE sponsorships SET ends_at = %s WHERE venue_id = %s AND ends_at > %s AND starts_at < %s", (now, venue_id, now, now))
    conn.execute("DELETE FROM sponsor_requests WHERE venue_id = %s", (venue_id,))
