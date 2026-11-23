"""İşletme paketleri, on the server so the limits really hold (no payment yet: the plan is chosen).

- Ücretsiz ('pay_per_use' in the data, the old name): 3 campaigns a month (Istanbul month) once the venue is
  verified (free); none before. No statistics, scheduled or automatic campaigns.
- Aylık paket ('saas'): statistics, scheduled and automatic campaigns, unlimited campaigns.
- Kurucu mekanlar (the first venues that joined): the Aylık paket free for 3 months (the badge stays).
- Deneme: the Aylık paket free for 15 days, once per venue.
"""
from datetime import datetime, timezone

import psycopg

FREE_CAMPAIGNS_PER_MONTH = 3  # for verified venues
FOUNDER_DAYS = 90
TRIAL_DAYS = 15
PLANS = ("saas", "pay_per_use")


class PlanError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


def business_access(conn: psycopg.Connection, user: dict, now: datetime | None = None) -> dict:
    """What the business's plan and venue give it, and how its next campaign is covered:
    saas / founder / free (this month's) / unverified (verify first) / blocked (this month's are used)."""
    from app.summary import month_bounds

    if user.get("role") != "business":
        raise PlanError("Yalnızca işletme hesapları için.", 403)
    now = now or datetime.now(timezone.utc)
    start, _ = month_bounds(now)
    row = conn.execute(
        """
        SELECT u.plan, COALESCE(p.verified, false) AS verified, p.trial_until, p.founder_until,
               COALESCE(p.founder, false) AND (p.founder_until IS NULL OR p.founder_until > %s) AS founder,
               (SELECT count(*) FROM campaigns c WHERE c.venue_id = u.venue_id AND c.paid_with = 'free'
                  AND c.starts_at >= %s)::int AS free_used
        FROM users u LEFT JOIN venue_profiles p ON p.venue_id = u.venue_id
        WHERE u.id = %s
        """,
        (now, start, user["id"]),
    ).fetchone()
    trial = row["trial_until"] is not None and row["trial_until"] > now
    plan = "saas" if row["plan"] == "saas" or trial else "pay_per_use"
    free_left = max(0, FREE_CAMPAIGNS_PER_MONTH - row["free_used"]) if row["verified"] else 0
    if plan == "saas":
        next_campaign = "saas"
    elif row["founder"]:
        next_campaign = "founder"
    elif not row["verified"]:
        next_campaign = "unverified"
    elif free_left:
        next_campaign = "free"
    else:
        next_campaign = "blocked"
    return {
        "plan": plan,
        "founder": row["founder"],
        "verified": row["verified"],
        "stats": plan == "saas" or row["founder"],
        "free_campaigns_per_month": FREE_CAMPAIGNS_PER_MONTH,
        "free_campaigns_left": free_left,  # this month
        "next_campaign": next_campaign,
        # 15-day trial of the Aylık paket: running until, and whether it can still be started
        "trial_until": row["trial_until"] if trial else None,
        "trial_available": row["trial_until"] is None and row["plan"] != "saas",
        "founder_until": row["founder_until"] if row["founder"] else None,
    }


def start_trial(conn: psycopg.Connection, user: dict, now: datetime) -> dict:
    """"15 gün ücretsiz dene": the Aylık paket, once per venue (a new account for the same venue does not
    get another)."""
    from datetime import timedelta

    access = business_access(conn, user, now)
    if not access["trial_available"]:
        raise PlanError("Ücretsiz deneme bu mekan için kullanıldı.", 409)
    conn.execute(
        """
        INSERT INTO venue_profiles (venue_id, trial_until) VALUES (%s, %s)
        ON CONFLICT (venue_id) DO UPDATE SET trial_until = EXCLUDED.trial_until
        """,
        (user["venue_id"], now + timedelta(days=TRIAL_DAYS)),
    )
    return business_access(conn, user, now)


def set_business_plan(conn: psycopg.Connection, user: dict, plan: str) -> dict:
    if user.get("role") != "business":
        raise PlanError("Yalnızca işletme hesapları için.", 403)
    if plan not in PLANS:
        raise PlanError("Paket bulunamadı.")
    conn.execute("UPDATE users SET plan = %s WHERE id = %s", ("saas" if plan == "saas" else None, user["id"]))
    return business_access(conn, user)
