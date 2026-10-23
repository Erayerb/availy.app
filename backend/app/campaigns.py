"""v2 campaigns and coupons on the server.

A business sends a campaign ("next 2 hours, 20% off all coffees") to people within a radius;
customers take a coupon code, show it at the counter and the business marks it used.
"""
import secrets
from datetime import datetime, timedelta

import psycopg

MAX_MESSAGE = 140
RADIUS_KM = (1, 2, 5)
# No 0/O, 1/I or 8/B, so codes are easy to read aloud and type
ALPHABET = "ACDEFGHJKLMNPQRSTUVWXYZ234679"

# Everything a list needs, with the coupon counts
CAMPAIGN_SELECT = """
    SELECT c.id, c.venue_id, v.name AS venue_name, ST_Y(v.location::geometry) AS lat, ST_X(v.location::geometry) AS lon,
           c.message, c.discount, c.radius_km::float AS radius_km, c.max_claims, c.duration_hours, c.starts_at, c.ends_at,
           (SELECT count(*) FROM coupons k WHERE k.campaign_id = c.id)::int AS claims,
           (SELECT count(*) FROM coupons k WHERE k.campaign_id = c.id AND k.redeemed_at IS NOT NULL)::int AS redemptions,
           (SELECT count(*) FROM campaign_views w WHERE w.campaign_id = c.id)::int AS views
    FROM campaigns c JOIN venues v ON v.id = c.venue_id
"""


class CampaignError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def _business_venue(user: dict) -> int:
    if user.get("role") != "business" or not user.get("venue_id"):
        raise CampaignError("Kampanyaları yalnızca mekanı seçili işletme hesapları yönetir.", 403)
    return user["venue_id"]


def create_campaign(
    conn: psycopg.Connection,
    user: dict,
    message: str,
    discount: int | None,
    radius_km: float,
    max_claims: int | None,
    duration_hours: int,
    now: datetime,
) -> dict:
    venue_id = _business_venue(user)
    text = " ".join(message.split())
    if len(text) < 5:
        raise CampaignError("Kampanya mesajını yaz.")
    if len(text) > MAX_MESSAGE:
        raise CampaignError(f"Mesaj en fazla {MAX_MESSAGE} karakter olabilir.")
    if radius_km not in RADIUS_KM:
        raise CampaignError("Mesafe 1, 2 ya da 5 km olabilir.")
    if not 1 <= duration_hours <= 24:
        raise CampaignError("Süre 1 ile 24 saat arasında olmalı.")
    if discount is not None and not 1 <= discount <= 90:
        raise CampaignError("İndirim %1 ile %90 arasında olmalı.")
    if max_claims is not None and max_claims < 1:
        raise CampaignError("Kişi sınırı en az 1 olmalı.")
    row = conn.execute(
        """
        INSERT INTO campaigns (venue_id, business_id, message, discount, radius_km, max_claims, duration_hours, starts_at, ends_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (venue_id, user["id"], text, discount, radius_km, max_claims, duration_hours, now, now + timedelta(hours=duration_hours)),
    ).fetchone()
    return campaign(conn, row["id"])


def campaign(conn: psycopg.Connection, campaign_id: int) -> dict:
    return conn.execute(CAMPAIGN_SELECT + " WHERE c.id = %s", (campaign_id,)).fetchone()


def active_campaigns(conn: psycopg.Connection, now: datetime) -> list[dict]:
    """Every running campaign; the app shows a customer those whose radius reaches them."""
    return conn.execute(
        CAMPAIGN_SELECT + " WHERE c.starts_at <= %s AND c.ends_at > %s ORDER BY c.ends_at LIMIT 500", (now, now)
    ).fetchall()


def my_campaigns(conn: psycopg.Connection, user: dict) -> list[dict]:
    """The business's campaigns, newest first, with views, coupons and uses."""
    venue_id = _business_venue(user)
    return conn.execute(
        CAMPAIGN_SELECT + " WHERE c.venue_id = %s AND NOT c.hidden ORDER BY c.starts_at DESC LIMIT 200", (venue_id,)
    ).fetchall()


def _own_campaign(conn: psycopg.Connection, user: dict, campaign_id: int) -> None:
    venue_id = _business_venue(user)
    row = conn.execute("SELECT venue_id FROM campaigns WHERE id = %s", (campaign_id,)).fetchone()
    if row is None or row["venue_id"] != venue_id:
        raise CampaignError("Kampanya bulunamadı.", 404)


def end_campaign(conn: psycopg.Connection, user: dict, campaign_id: int, now: datetime) -> dict:
    _own_campaign(conn, user, campaign_id)
    conn.execute("UPDATE campaigns SET ends_at = LEAST(ends_at, %s) WHERE id = %s", (now, campaign_id))
    return campaign(conn, campaign_id)


def hide_campaigns(conn: psycopg.Connection, user: dict, ids: list[int], now: datetime) -> None:
    """"Sil": only ended campaigns, and only from the business's list (customers keep their coupons)."""
    venue_id = _business_venue(user)
    conn.execute(
        "UPDATE campaigns SET hidden = true WHERE id = ANY(%s) AND venue_id = %s AND ends_at <= %s", (ids, venue_id, now)
    )


def record_view(conn: psycopg.Connection, user: dict, campaign_id: int) -> None:
    if user.get("role") == "business":
        return
    conn.execute(
        """
        INSERT INTO campaign_views (campaign_id, user_id)
        SELECT id, %s FROM campaigns WHERE id = %s ON CONFLICT DO NOTHING
        """,
        (user["id"], campaign_id),
    )


COUPON_SELECT = """
    SELECT k.code, k.campaign_id, c.venue_id, v.name AS venue_name, c.message, c.discount, k.claimed_at, k.redeemed_at,
           c.ends_at
    FROM coupons k JOIN campaigns c ON c.id = k.campaign_id JOIN venues v ON v.id = c.venue_id
"""


def claim_coupon(conn: psycopg.Connection, user: dict, campaign_id: int, now: datetime) -> dict:
    """One coupon per campaign and person; asking again returns the same code."""
    if user.get("role") == "business":
        raise CampaignError("İşletme hesapları kupon alamaz.", 403)
    # Locks the campaign so two people cannot take the last coupon at once
    row = conn.execute(
        "SELECT max_claims, starts_at, ends_at FROM campaigns WHERE id = %s FOR UPDATE", (campaign_id,)
    ).fetchone()
    if row is None:
        raise CampaignError("Kampanya bulunamadı.", 404)
    mine = conn.execute(COUPON_SELECT + " WHERE k.campaign_id = %s AND k.user_id = %s", (campaign_id, user["id"])).fetchone()
    if mine:
        return mine
    if not row["starts_at"] <= now < row["ends_at"]:
        raise CampaignError("Bu kampanya bitti.", 409)
    taken = conn.execute("SELECT count(*)::int AS n FROM coupons WHERE campaign_id = %s", (campaign_id,)).fetchone()["n"]
    if row["max_claims"] is not None and taken >= row["max_claims"]:
        raise CampaignError("Bu kampanyanın kupon sınırı doldu.", 409)
    for _ in range(10):
        code = "AV-" + "".join(secrets.choice(ALPHABET) for _ in range(4))
        inserted = conn.execute(
            """
            INSERT INTO coupons (code, campaign_id, user_id, claimed_at) VALUES (%s, %s, %s, %s)
            ON CONFLICT (code) DO NOTHING RETURNING code
            """,
            (code, campaign_id, user["id"], now),
        ).fetchone()
        if inserted:
            return conn.execute(COUPON_SELECT + " WHERE k.code = %s", (code,)).fetchone()
    raise CampaignError("Kupon oluşturulamadı, tekrar dene.", 503)


def my_coupons(conn: psycopg.Connection, user: dict) -> list[dict]:
    return conn.execute(COUPON_SELECT + " WHERE k.user_id = %s ORDER BY k.claimed_at DESC LIMIT 200", (user["id"],)).fetchall()


def venue_coupons(conn: psycopg.Connection, user: dict) -> list[dict]:
    """Business: coupons taken for its campaigns (who took them is not shown)."""
    venue_id = _business_venue(user)
    return conn.execute(COUPON_SELECT + " WHERE c.venue_id = %s ORDER BY k.claimed_at DESC LIMIT 200", (venue_id,)).fetchall()


def normalize_code(code: str) -> str:
    return "".join(code.split()).upper()


def redeem_coupon(conn: psycopg.Connection, user: dict, raw_code: str, now: datetime) -> dict:
    """The business marks a customer's coupon used at the counter."""
    venue_id = _business_venue(user)
    code = normalize_code(raw_code)
    coupon = conn.execute(COUPON_SELECT + " WHERE k.code = %s FOR UPDATE OF k", (code,)).fetchone()
    if coupon is None:
        raise CampaignError("Bu kod bulunamadı.", 404)
    if coupon["venue_id"] != venue_id:
        raise CampaignError("Bu kod başka bir mekana ait.", 403)
    if coupon["redeemed_at"] is not None:
        raise CampaignError("Bu kod zaten kullanılmış.", 409)
    # The customer's app says "Süresi doldu" then too
    if coupon["ends_at"] <= now:
        raise CampaignError("Bu kuponun kampanyası bitti.", 409)
    conn.execute("UPDATE coupons SET redeemed_at = %s WHERE code = %s", (now, code))
    return {**coupon, "redeemed_at": now}
