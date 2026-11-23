"""Puanların: the spendable balance (earned minus spent), where points came from and went, and what can be
taken with them nearby (standing rewards and special coupons)."""
from datetime import datetime

import psycopg

REASONS = {
    "checkin": "Check-in",
    "first_checkin": "Keşif (ilk check-in)",
    "venue_added": "Eklediğin mekan onaylandı",
    "invite": "Davetinle katılan",
    "badge": "Rozet",
    "stamp": "Damga",
    "coupon": "Kupon kullandın",
    "moment": "Fotoğraf paylaştın",
    "together": "Birlikte check-in",
    "task": "İlk adımlar",
}


def wallet(conn: psycopg.Connection, me: dict) -> dict:
    """Balance, totals and the last 40 movements (+ earned, − spent), newest first."""
    totals = conn.execute(
        """
        SELECT (SELECT COALESCE(sum(amount), 0) FROM points WHERE user_id = %(me)s)::int AS earned,
               (SELECT COALESCE(sum(amount), 0) FROM point_spends WHERE user_id = %(me)s)::int AS spent
        """,
        {"me": me["id"]},
    ).fetchone()
    moves = conn.execute(
        """
        SELECT * FROM (
            SELECT p.created_at AS at, p.amount, p.reason, v.name AS venue_name
            FROM points p LEFT JOIN checkins c ON c.id = p.checkin_id LEFT JOIN venues v ON v.id = c.venue_id
            WHERE p.user_id = %(me)s
            UNION ALL
            SELECT s.created_at, -s.amount, CASE WHEN m.standing THEN 'reward' ELSE 'special_coupon' END, v.name
            FROM point_spends s LEFT JOIN coupons k ON k.code = s.coupon_code
            LEFT JOIN campaigns m ON m.id = k.campaign_id LEFT JOIN venues v ON v.id = m.venue_id
            WHERE s.user_id = %(me)s
        ) moves ORDER BY at DESC LIMIT 40
        """,
        {"me": me["id"]},
    ).fetchall()
    labels = {**REASONS, "reward": "Ödül aldın", "special_coupon": "Özel kupon aldın"}
    return {
        "balance": totals["earned"] - totals["spent"],
        "earned": totals["earned"],
        "spent": totals["spent"],
        "moves": [{**m, "label": labels.get(m["reason"], m["reason"])} for m in moves],
    }


def spendable_offers(conn: psycopg.Connection, lat: float | None, lon: float | None, now: datetime) -> list[dict]:
    """What points can buy right now: standing rewards and running special coupons, nearest first."""
    near = lat is not None and lon is not None
    return conn.execute(
        f"""
        SELECT c.id AS campaign_id, c.standing, c.points_price AS points, c.discount, c.message,
               v.id AS venue_id, v.name AS venue_name, v.district,
               {"ST_Distance(v.location, ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography)::int" if near else "NULL::int"} AS distance_m
        FROM campaigns c JOIN venues v ON v.id = c.venue_id
        WHERE c.points_price > 0 AND NOT c.checkin_only AND c.starts_at <= %(now)s AND c.ends_at > %(now)s
        ORDER BY {"distance_m" if near else "c.points_price"}, c.id
        LIMIT 30
        """,
        {"lat": lat, "lon": lon, "now": now},
    ).fetchall()
