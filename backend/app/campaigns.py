"""v2 campaigns and coupons on the server.

A business sends a campaign ("next 2 hours, 20% off all coffees") to people within a radius;
customers take a coupon code, show it at the counter and the business marks it used.
"""
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import psycopg

from app.levels import welcome_left

MAX_MESSAGE = 140
RADIUS_KM = (1, 2, 5)
# No 0/O, 1/I or 8/B, so codes are easy to read aloud and type
ALPHABET = "ACDEFGHJKLMNPQRSTUVWXYZ234679"

# Coupons are free. The business may make a campaign a "puanla açılan özel kupon" (e.g. a bigger discount
# for people who use the app a lot): then a coupon costs that many points. A regular earns ~50-70 a week.
ISTANBUL = ZoneInfo("Europe/Istanbul")
POINTS_STEP = 10  # special coupons and the standing reward: any multiple of 10, up to MAX_POINTS
MAX_POINTS = 2000
REWARD_EVERY = timedelta(days=7)  # the standing reward: once a week per person
REWARD_YEARS = 10  # a standing reward "ends" this far away (until the business turns it off)


def valid_points(points: int) -> bool:
    return POINTS_STEP <= points <= MAX_POINTS and points % POINTS_STEP == 0


def spendable_points(conn: psycopg.Connection, user_id: int) -> int:
    """Everything earned minus what was spent (levels and rankings use only what was earned)."""
    return conn.execute(
        """
        SELECT (SELECT COALESCE(sum(amount), 0) FROM points WHERE user_id = %(id)s)
             - (SELECT COALESCE(sum(amount), 0) FROM point_spends WHERE user_id = %(id)s) AS n
        """,
        {"id": user_id},
    ).fetchone()["n"]


# Everything a list needs, with the coupon counts
CAMPAIGN_SELECT = """
    SELECT c.points_price, c.id, c.venue_id, v.name AS venue_name, ST_Y(v.location::geometry) AS lat, ST_X(v.location::geometry) AS lon,
           c.message, c.discount, c.radius_km::float AS radius_km, c.max_claims, c.duration_hours, c.starts_at, c.ends_at, c.checkin_only,
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
    checkin_only: bool = False,
    points_price: int = 0,
) -> dict:
    venue_id = _business_venue(user)
    if points_price and not valid_points(points_price):
        raise CampaignError(f"Özel kupon {POINTS_STEP} ile {MAX_POINTS} arası, {POINTS_STEP}'un katı puan olabilir.")
    if points_price and checkin_only:
        raise CampaignError("Check-in yapana kupon puanla açılamaz.")
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
    from app.plans import business_access

    access = business_access(conn, user, now)
    if access["next_campaign"] == "unverified":
        raise CampaignError(
            f"Kampanya göndermek için mekanını doğrula (ücretsiz): ayda {access['free_campaigns_per_month']} kampanya hakkın olur. "
            "Sınırsız kampanya Aylık pakette.", 402
        )
    if access["next_campaign"] == "blocked":
        raise CampaignError(
            f"Bu ay {access['free_campaigns_per_month']} ücretsiz kampanyanı kullandın. Sınırsız kampanya için Aylık paket'e geç.", 402
        )
    paid_with = access["next_campaign"]
    row = conn.execute(
        """
        INSERT INTO campaigns (venue_id, business_id, message, discount, radius_km, max_claims, duration_hours, starts_at, ends_at,
                               checkin_only, paid_with, points_price)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (
            venue_id, user["id"], text, discount, radius_km, max_claims, duration_hours, now,
            now + timedelta(hours=duration_hours), checkin_only, paid_with, points_price,
        ),
    ).fetchone()
    return campaign(conn, row["id"])


def campaign(conn: psycopg.Connection, campaign_id: int) -> dict:
    return conn.execute(CAMPAIGN_SELECT + " WHERE c.id = %s", (campaign_id,)).fetchone()


def active_campaigns(conn: psycopg.Connection, now: datetime) -> list[dict]:
    """Every running campaign; the app shows a customer those whose radius reaches them."""
    from app.automation import run_due_schedules

    run_due_schedules(conn, now)  # scheduled campaigns whose time has come
    return conn.execute(
        CAMPAIGN_SELECT + " WHERE c.starts_at <= %s AND c.ends_at > %s AND NOT c.standing ORDER BY c.ends_at LIMIT 500", (now, now)
    ).fetchall()


def my_campaigns(conn: psycopg.Connection, user: dict) -> list[dict]:
    """The business's campaigns, newest first, with views, coupons and uses."""
    from app.automation import run_due_schedules

    venue_id = _business_venue(user)
    run_due_schedules(conn, datetime.now(timezone.utc))
    return conn.execute(
        CAMPAIGN_SELECT + " WHERE c.venue_id = %s AND NOT c.hidden AND NOT c.standing ORDER BY c.starts_at DESC LIMIT 200", (venue_id,)
    ).fetchall()


def _own_campaign(conn: psycopg.Connection, user: dict, campaign_id: int) -> None:
    venue_id = _business_venue(user)
    row = conn.execute("SELECT venue_id FROM campaigns WHERE id = %s", (campaign_id,)).fetchone()
    if row is None or row["venue_id"] != venue_id:
        raise CampaignError("Kampanya bulunamadı.", 404)


def end_campaign(conn: psycopg.Connection, user: dict, campaign_id: int, now: datetime) -> dict:
    _own_campaign(conn, user, campaign_id)
    conn.execute("UPDATE campaigns SET ends_at = LEAST(ends_at, %s) WHERE id = %s", (now, campaign_id))
    # Ended early: coupons bought and not used yet cannot be used any more, so their points come back
    conn.execute(
        """
        DELETE FROM point_spends s USING coupons k
        WHERE s.coupon_code = k.code AND k.campaign_id = %s AND k.redeemed_at IS NULL
        """,
        (campaign_id,),
    )
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
    """One coupon per campaign and person; asking again returns the same code. The standing reward: a coupon
    not used yet is returned again; a new one once a week."""
    if user.get("role") == "business":
        raise CampaignError("İşletme hesapları kupon alamaz.", 403)
    # Locks the campaign so two people cannot take the last coupon at once
    row = conn.execute(
        "SELECT venue_id, max_claims, starts_at, ends_at, checkin_only, points_price, standing FROM campaigns WHERE id = %s FOR UPDATE",
        (campaign_id,),
    ).fetchone()
    if row is None:
        raise CampaignError("Kampanya bulunamadı.", 404)
    if row["standing"]:
        unused = conn.execute(
            COUPON_SELECT + " WHERE k.campaign_id = %s AND k.user_id = %s AND k.redeemed_at IS NULL AND k.hidden_at IS NULL",
            (campaign_id, user["id"]),
        ).fetchone()
        if unused:
            return unused
        last = conn.execute(
            "SELECT max(claimed_at) AS at FROM coupons WHERE campaign_id = %s AND user_id = %s", (campaign_id, user["id"])
        ).fetchone()["at"]
        if last is not None and now - last < REWARD_EVERY:
            again = (last + REWARD_EVERY).astimezone(ISTANBUL)
            raise CampaignError(f"Bu ödülü haftada bir alabilirsin; tekrar {again.day}.{again.month:02d} {again:%H:%M}'den sonra.", 409)
    else:
        mine = conn.execute(COUPON_SELECT + " WHERE k.campaign_id = %s AND k.user_id = %s", (campaign_id, user["id"])).fetchone()
        if mine:
            # Deleted from Kuponlarım and asked for again: back in the list (still one per person)
            conn.execute("UPDATE coupons SET hidden_at = NULL WHERE code = %s", (mine["code"],))
            return mine
    if not row["starts_at"] <= now < row["ends_at"]:
        raise CampaignError("Bu kampanya bitti.", 409)
    # "Check-in yapana kupon": only people who checked in there since the campaign started
    if row["checkin_only"] and not conn.execute(
        "SELECT 1 FROM checkins WHERE venue_id = %s AND user_id = %s AND created_at >= %s",
        (row["venue_id"], user["id"], row["starts_at"]),
    ).fetchone():
        raise CampaignError("Bu kupon mekanda check-in yapanlara veriliyor: önce check-in yap.", 403)
    taken = conn.execute("SELECT count(*)::int AS n FROM coupons WHERE campaign_id = %s", (campaign_id,)).fetchone()["n"]
    if row["max_claims"] is not None and taken >= row["max_claims"]:
        raise CampaignError("Bu kampanyanın kupon sınırı doldu.", 409)
    price = 0 if row["checkin_only"] else row["points_price"]
    # Kâşif's welcome gift: one standing reward without points
    welcome = bool(price and row["standing"] and welcome_left(conn, user["id"]))
    if welcome:
        price = 0
    if price:
        # Locks the person, so two taps cannot spend the same points twice
        conn.execute("SELECT id FROM users WHERE id = %s FOR UPDATE", (user["id"],))
        have = spendable_points(conn, user["id"])
        if have < price:
            what = "ödül" if row["standing"] else "özel kupon"
            raise CampaignError(f"Bu {what} {price} puan; {have} puanın var. Check-in yaparak puan kazan.", 402)
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
            if welcome:  # Kâşif's gift is used up
                conn.execute(
                    "UPDATE level_rewards SET welcome_used_at = %s WHERE user_id = %s AND level_id = 'explorer'", (now, user["id"])
                )
            if price:
                conn.execute(
                    "INSERT INTO point_spends (user_id, amount, coupon_code, created_at) VALUES (%s, %s, %s, %s)",
                    (user["id"], price, code, now),
                )
            return conn.execute(COUPON_SELECT + " WHERE k.code = %s", (code,)).fetchone()
    raise CampaignError("Kupon oluşturulamadı, tekrar dene.", 503)


def my_coupons(conn: psycopg.Connection, user: dict) -> list[dict]:
    return conn.execute(
        COUPON_SELECT + " WHERE k.user_id = %s AND k.hidden_at IS NULL ORDER BY k.claimed_at DESC LIMIT 200", (user["id"],)
    ).fetchall()


def hide_coupon(conn: psycopg.Connection, user: dict, code: str, now: datetime) -> None:
    """"Sil" in Kuponlarım: gone from my list; the business still counts it, and a coupon not used yet cannot
    be used any more (its points do not come back)."""
    done = conn.execute(
        "UPDATE coupons SET hidden_at = %s WHERE code = %s AND user_id = %s AND hidden_at IS NULL",
        (now, normalize_code(code), user["id"]),
    ).rowcount
    if not done:
        raise CampaignError("Kupon bulunamadı.", 404)


def venue_coupons(conn: psycopg.Connection, user: dict) -> list[dict]:
    """Business: coupons taken for its campaigns (who took them is not shown)."""
    venue_id = _business_venue(user)
    return conn.execute(COUPON_SELECT + " WHERE c.venue_id = %s ORDER BY k.claimed_at DESC LIMIT 200", (venue_id,)).fetchall()


POINTS_PER_COUPON = 10


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
    if conn.execute("SELECT hidden_at FROM coupons WHERE code = %s", (code,)).fetchone()["hidden_at"] is not None:
        raise CampaignError("Müşteri bu kuponu silmiş.", 409)
    # The customer's app says "Süresi doldu" then too
    if coupon["ends_at"] <= now:
        raise CampaignError("Bu kuponun kampanyası bitti.", 409)
    conn.execute("UPDATE coupons SET redeemed_at = %s WHERE code = %s", (now, code))
    # The customer's points: 10 per used coupon, guests half
    conn.execute(
        """
        INSERT INTO points (user_id, amount, reason, created_at)
        SELECT user_id, (%s * (CASE WHEN (SELECT is_guest FROM users u WHERE u.id = k.user_id) THEN 0.5 ELSE 1 END))::int, 'coupon', %s
        FROM coupons k WHERE code = %s
        """,
        (POINTS_PER_COUPON, now, code),
    )
    return {**coupon, "redeemed_at": now}


def coupons_for_checkin(conn: psycopg.Connection, user: dict, venue_id: int, now: datetime) -> list[dict]:
    """Right after a check-in: the coupons of the venue's running "check-in yapana kupon" campaigns."""
    from app.automation import run_due_schedules

    run_due_schedules(conn, now)
    running = conn.execute(
        "SELECT id FROM campaigns WHERE venue_id = %s AND checkin_only AND starts_at <= %s AND ends_at > %s",
        (venue_id, now, now),
    ).fetchall()
    coupons = []
    for campaign in running:
        try:
            coupons.append(claim_coupon(conn, user, campaign["id"], now))
        except CampaignError:
            pass  # e.g. the limit was reached
    return coupons


# ---- the standing reward ("200 puan = %10 indirim", always on the venue page) ----


def _reward_row(conn: psycopg.Connection, venue_id: int, now: datetime) -> dict | None:
    return conn.execute(
        """
        SELECT id, points_price AS points, discount, ends_at > %s AS active FROM campaigns
        WHERE venue_id = %s AND standing ORDER BY id DESC LIMIT 1
        """,
        (now, venue_id),
    ).fetchone()


def my_reward(conn: psycopg.Connection, user: dict, now: datetime) -> dict | None:
    return _reward_row(conn, _business_venue(user), now)


def save_reward(conn: psycopg.Connection, user: dict, points: int, discount: int, active: bool, now: datetime) -> dict:
    """The business's standing reward: points for a discount, once a week per person (free in every plan; it
    does not use the month's campaigns). Turned off: coupons not used yet give their points back."""
    venue_id = _business_venue(user)
    if not valid_points(points):
        raise CampaignError(f"Puan {POINTS_STEP} ile {MAX_POINTS} arası, {POINTS_STEP}'un katı olmalı.")
    if not 1 <= discount <= 90:
        raise CampaignError("İndirim %1 ile %90 arasında olmalı.")
    message = f"availo ödülü: {points} puan = %{discount} indirim"
    current = _reward_row(conn, venue_id, now)
    ends = now + timedelta(days=365 * REWARD_YEARS) if active else now
    if current is None:
        conn.execute(
            """
            INSERT INTO campaigns (venue_id, business_id, message, discount, radius_km, max_claims, duration_hours,
                                   starts_at, ends_at, standing, points_price, paid_with)
            VALUES (%s, %s, %s, %s, 10, NULL, 24, %s, %s, true, %s, 'standing')
            """,
            (venue_id, user["id"], message, discount, now, ends, points),
        )
    else:
        conn.execute(
            "UPDATE campaigns SET message = %s, discount = %s, points_price = %s, ends_at = %s WHERE id = %s",
            (message, discount, points, ends, current["id"]),
        )
        if not active:
            conn.execute(
                """
                DELETE FROM point_spends s USING coupons k
                WHERE s.coupon_code = k.code AND k.campaign_id = %s AND k.redeemed_at IS NULL
                """,
                (current["id"],),
            )
    return _reward_row(conn, venue_id, now)


def venue_reward(conn: psycopg.Connection, venue_id: int, viewer: dict | None, now: datetime) -> dict | None:
    """On the venue page: the standing reward, and for me when I may take it again (None: now)."""
    row = _reward_row(conn, venue_id, now)
    if row is None or not row["active"]:
        return None
    next_at = None
    if viewer is not None:
        last = conn.execute(
            "SELECT max(claimed_at) AS at, bool_or(redeemed_at IS NULL AND hidden_at IS NULL) AS unused FROM coupons"
            " WHERE campaign_id = %s AND user_id = %s",
            (row["id"], viewer["id"]),
        ).fetchone()
        if last["at"] is not None and not last["unused"] and now - last["at"] < REWARD_EVERY:
            next_at = last["at"] + REWARD_EVERY
    # Without points for me: Kâşif's welcome gift
    free = "welcome" if viewer is not None and welcome_left(conn, viewer["id"]) else None
    return {"campaign_id": row["id"], "points": row["points"], "discount": row["discount"], "next_at": next_at, "free": free}
