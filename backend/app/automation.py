"""v2: a business's automations, run by the server (they used to run on the business's phone, only
while its app was open).

* Ölü saat: after a check-in, when the open venue's fresh check-ins say Sakin (from at least
  2 people), the business gets a 🔔 alert (at most every 2 hours) and, with "Otomatik kampanya"
  on, a ready-made campaign is sent (at most every 3 hours, not while one is running).
* Zamanlanmış kampanyalar: "every Tuesday 13–16": the campaign is created the first time anyone
  asks for running campaigns (or checks in) inside that window, once per day. Nothing has to run
  on a clock, so a sleeping server misses nothing that anyone could have seen.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from app.campaigns import RADIUS_KM, CampaignError, create_campaign

ISTANBUL = ZoneInfo("Europe/Istanbul")
ALERT_EVERY = timedelta(hours=2)
AUTO_CAMPAIGN_EVERY = timedelta(hours=3)
DEAD_HOUR_MIN_PEOPLE = 2  # one person's "Sakin" is not enough
AUTO_DISCOUNT, AUTO_HOURS, AUTO_RADIUS_KM = 20, 2, 2
SUGGESTED_ITEMS = {
    "cafe": "tüm kahvelerde",
    "bar": "tüm içeceklerde",
    "restaurant": "tüm menüde",
    "coworking": "günlük masa ücretinde",
    "library": "kafeteryada",
}


class AutomationError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def dead_hour_message(category: str, discount: int = AUTO_DISCOUNT, hours: int = AUTO_HOURS) -> str:
    items = SUGGESTED_ITEMS.get(category, "tüm siparişlerde")
    return f"Şu an çok sayıda boş yerimiz var! Önümüzdeki {hours} saat {items} %{discount} indirim."


def _business_venue(user: dict) -> int:
    if user.get("role") != "business" or not user.get("venue_id"):
        raise AutomationError("Bu ayarlar işletme hesapları içindir.", 403)
    return user["venue_id"]


# ---- settings ----


def get_settings(conn: psycopg.Connection, user: dict) -> dict:
    venue_id = _business_venue(user)
    row = conn.execute(
        "SELECT dead_hour_alerts, auto_campaign FROM venue_profiles WHERE venue_id = %s", (venue_id,)
    ).fetchone()
    return dict(row) if row else {"dead_hour_alerts": True, "auto_campaign": False}


def save_settings(conn: psycopg.Connection, user: dict, dead_hour_alerts: bool, auto_campaign: bool, now: datetime) -> dict:
    venue_id = _business_venue(user)
    conn.execute(
        """
        INSERT INTO venue_profiles (venue_id, dead_hour_alerts, auto_campaign, updated_at) VALUES (%s, %s, %s, %s)
        ON CONFLICT (venue_id) DO UPDATE SET dead_hour_alerts = EXCLUDED.dead_hour_alerts,
                                             auto_campaign = EXCLUDED.auto_campaign, updated_at = EXCLUDED.updated_at
        """,
        (venue_id, dead_hour_alerts, auto_campaign, now),
    )
    return {"dead_hour_alerts": dead_hour_alerts, "auto_campaign": auto_campaign}


# ---- dead hour (after each check-in) ----


def after_checkin(conn: psycopg.Connection, venue_id: int, now: datetime) -> None:
    """Called after every check-in: a quiet, open venue alerts its business (and may send a campaign)."""
    from app.checkins import load_crowds
    from app.hours import venue_hours

    business = conn.execute(
        """
        SELECT u.*, COALESCE(p.dead_hour_alerts, true) AS dead_hour_alerts, COALESCE(p.auto_campaign, false) AS auto_campaign,
               v.category, v.open_hour, v.close_hour
        FROM users u JOIN venues v ON v.id = u.venue_id LEFT JOIN venue_profiles p ON p.venue_id = v.id
        WHERE u.venue_id = %s AND u.role = 'business' AND NOT u.frozen
        ORDER BY u.id LIMIT 1
        """,
        (venue_id,),
    ).fetchone()
    if business is None or not (business["dead_hour_alerts"] or business["auto_campaign"]):
        return
    if not venue_hours(business).is_open_at_hour(now.astimezone(ISTANBUL).hour):
        return
    crowd = load_crowds(conn, [venue_id], now)[venue_id]
    if crowd.state != "live" or crowd.level != "low" or crowd.reporters < DEAD_HOUR_MIN_PEOPLE:
        return

    def last(kind: str) -> datetime | None:
        row = conn.execute(
            "SELECT max(created_at) AS at FROM business_alerts WHERE venue_id = %s AND kind = %s", (venue_id, kind)
        ).fetchone()
        return row["at"]

    if business["dead_hour_alerts"] and (last("dead_hour") is None or now - last("dead_hour") >= ALERT_EVERY):
        conn.execute("INSERT INTO business_alerts (venue_id, kind, created_at) VALUES (%s, 'dead_hour', %s)", (venue_id, now))

    running = conn.execute(
        "SELECT 1 FROM campaigns WHERE venue_id = %s AND starts_at <= %s AND ends_at > %s", (venue_id, now, now)
    ).fetchone()
    previous = last("auto_campaign")
    if business["auto_campaign"] and running is None and (previous is None or now - previous >= AUTO_CAMPAIGN_EVERY):
        try:
            sent = create_campaign(
                conn, business, dead_hour_message(business["category"]), AUTO_DISCOUNT, AUTO_RADIUS_KM, None, AUTO_HOURS, now
            )
        except CampaignError:
            return
        conn.execute("UPDATE campaigns SET source = 'auto' WHERE id = %s", (sent["id"],))
        conn.execute(
            "INSERT INTO business_alerts (venue_id, kind, campaign_id, created_at) VALUES (%s, 'auto_campaign', %s, %s)",
            (venue_id, sent["id"], now),
        )


# ---- scheduled campaigns ----

SCHEDULE_FIELDS = "id, message, discount, radius_km::float AS radius_km, days, start_hour, duration_hours, active"


def my_schedules(conn: psycopg.Connection, user: dict) -> list[dict]:
    venue_id = _business_venue(user)
    return conn.execute(
        f"SELECT {SCHEDULE_FIELDS} FROM campaign_schedules WHERE venue_id = %s ORDER BY created_at", (venue_id,)
    ).fetchall()


def save_schedule(
    conn: psycopg.Connection,
    user: dict,
    message: str,
    discount: int | None,
    radius_km: float,
    days: list[int],
    start_hour: int,
    duration_hours: int,
    now: datetime,
) -> dict:
    venue_id = _business_venue(user)
    text = " ".join(message.split())
    if not 5 <= len(text) <= 140:
        raise AutomationError("Kampanya mesajını yaz (en fazla 140 karakter).")
    clean_days = sorted(set(days))
    if not clean_days or any(d not in range(7) for d in clean_days):
        raise AutomationError("En az bir gün seç.")
    if start_hour not in range(24):
        raise AutomationError("Başlangıç saati 0–23 olmalı.")
    if duration_hours not in range(1, 13):
        raise AutomationError("Süre 1 ile 12 saat arasında olmalı.")
    if radius_km not in RADIUS_KM:
        raise AutomationError("Mesafe 1, 2 ya da 5 km olabilir.")
    if discount is not None and not 1 <= discount <= 90:
        raise AutomationError("İndirim %1 ile %90 arasında olmalı.")
    row = conn.execute(
        """
        INSERT INTO campaign_schedules (venue_id, business_id, message, discount, radius_km, days, start_hour, duration_hours, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (venue_id, user["id"], text, discount, radius_km, clean_days, start_hour, duration_hours, now),
    ).fetchone()
    return conn.execute(f"SELECT {SCHEDULE_FIELDS} FROM campaign_schedules WHERE id = %s", (row["id"],)).fetchone()


def set_schedule_active(conn: psycopg.Connection, user: dict, schedule_id: int, active: bool) -> None:
    venue_id = _business_venue(user)
    if conn.execute(
        "UPDATE campaign_schedules SET active = %s WHERE id = %s AND venue_id = %s RETURNING 1", (active, schedule_id, venue_id)
    ).fetchone() is None:
        raise AutomationError("Zamanlanmış kampanya bulunamadı.", 404)


def delete_schedule(conn: psycopg.Connection, user: dict, schedule_id: int) -> None:
    venue_id = _business_venue(user)
    conn.execute("DELETE FROM campaign_schedules WHERE id = %s AND venue_id = %s", (schedule_id, venue_id))


def run_due_schedules(conn: psycopg.Connection, now: datetime) -> None:
    """Turns the schedules whose window is open now into campaigns (once per schedule and day)."""
    local = now.astimezone(ISTANBUL)
    due = conn.execute(
        """
        SELECT s.*, v.category FROM campaign_schedules s JOIN venues v ON v.id = s.venue_id
        WHERE s.active AND %(weekday)s = ANY(s.days) AND s.start_hour <= %(hour)s AND %(hour)s < s.start_hour + s.duration_hours
          AND NOT EXISTS (SELECT 1 FROM campaign_schedule_runs r WHERE r.schedule_id = s.id AND r.run_date = %(date)s)
        """,
        {"weekday": local.weekday(), "hour": local.hour, "date": local.date()},
    ).fetchall()
    for s in due:
        business = conn.execute(
            "SELECT * FROM users WHERE venue_id = %s AND role = 'business' AND NOT frozen ORDER BY id LIMIT 1", (s["venue_id"],)
        ).fetchone()
        campaign_id = None
        if business is not None:
            # Only what is left of the window
            window_end = local.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(hours=s["start_hour"] + s["duration_hours"])
            hours_left = max(1, round((window_end - local).total_seconds() / 3600))
            try:
                sent = create_campaign(conn, business, s["message"], s["discount"], float(s["radius_km"]), None, hours_left, now)
                conn.execute("UPDATE campaigns SET source = 'schedule', ends_at = %s WHERE id = %s", (window_end, sent["id"]))
                campaign_id = sent["id"]
            except CampaignError:
                pass
        conn.execute(
            "INSERT INTO campaign_schedule_runs (schedule_id, run_date, campaign_id) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
            (s["id"], local.date(), campaign_id),
        )
