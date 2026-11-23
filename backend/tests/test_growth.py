"""Growth: first-week tasks, the first check-in, the standing reward, the 15-day trial, founders' 3 months,
the business's month report, the sales numbers and founder applications."""
from datetime import timedelta

from tests.test_business import account, auth, business_at
from tests.test_campaigns import CAMPAIGN, give_points
from tests.test_checkin_social import befriend
from tests.test_checkins import checkin, clock, venue_id  # noqa: F401 (clock is a fixture)
from tests.test_plus import PHOTO


def test_first_week_tasks_pay_once_and_bring_the_badge(client, conn, clock):
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    start = client.get("/v1/me/starter-tasks", headers=auth(ali)).json()
    assert [t["key"] for t in start["tasks"]] == ["checkin", "list", "friend", "photo"] and start["done"] == 0
    first = checkin(client, ali, venue_id(conn, "Test Kafe A")).json()
    assert first["first_ever"] is True
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    client.post("/v1/lists", json={"name": "Çalışmalık", "visibility": "private"}, headers=auth(ali))
    client.put("/v1/me/photo", json={"photo": PHOTO}, headers=auth(ali))
    done = client.get("/v1/me/starter-tasks", headers=auth(ali)).json()
    assert done["done"] == 4 and done["new_points"] == 40
    assert client.get("/v1/me/starter-tasks", headers=auth(ali)).json()["new_points"] == 0  # once
    badges = conn.execute("SELECT badge_id FROM user_badges b JOIN users u ON u.id = b.user_id WHERE u.username = 't_ali'").fetchall()
    assert "starter" in {b["badge_id"] for b in badges}
    clock.now += timedelta(hours=2)
    assert checkin(client, ali, venue_id(conn, "Test Cowork B")).json()["first_ever"] is False


def test_standing_reward_once_a_week(client, conn, clock):
    token, kafe = business_at(client, conn, plan="pay_per_use")
    ali = account(client, "t_ali")
    assert client.put("/v1/business/reward", json={"points": 205, "discount": 10}, headers=auth(token)).status_code == 400
    reward = client.put("/v1/business/reward", json={"points": 200, "discount": 10}, headers=auth(token)).json()
    assert (reward["points"], reward["discount"], reward["active"]) == (200, 10, True)
    # Not a campaign in the lists, and it does not use the month's campaigns
    assert client.get("/v1/campaigns").json() == []
    shown = client.get(f"/v1/venues/{kafe}/reward", headers=auth(ali)).json()
    assert (shown["points"], shown["discount"], shown["next_at"]) == (200, 10, None)
    give_points(conn, "t_ali", 500)
    url = f"/v1/campaigns/{shown['campaign_id']}/coupon"
    code = client.post(url, headers=auth(ali)).json()["code"]
    assert client.post(url, headers=auth(ali)).json()["code"] == code  # not used yet: the same one
    client.post("/v1/coupons/redeem", json={"code": code}, headers=auth(token))
    again = client.post(url, headers=auth(ali))
    assert again.status_code == 409 and "haftada bir" in again.json()["detail"]
    assert client.get(f"/v1/venues/{kafe}/reward", headers=auth(ali)).json()["next_at"]
    clock.now += timedelta(days=7, minutes=1)
    assert client.post(url, headers=auth(ali)).json()["code"] != code
    assert client.get("/v1/me/points", headers=auth(ali)).json()["balance"] == 100 + 10  # two rewards, +10 for the used coupon
    # Turned off: gone from the venue page
    client.put("/v1/business/reward", json={"points": 200, "discount": 10, "active": False}, headers=auth(token))
    assert client.get(f"/v1/venues/{kafe}/reward").json() is None


def test_fifteen_day_trial_once(client, conn, clock):
    token, kafe = business_at(client, conn, plan="pay_per_use")
    assert client.get("/v1/business/plan", headers=auth(token)).json()["trial_available"] is True
    started = client.post("/v1/business/trial", headers=auth(token)).json()
    assert started["plan"] == "saas" and started["stats"] and started["trial_until"]
    assert client.post("/v1/business/trial", headers=auth(token)).status_code == 409
    clock.now += timedelta(days=15, minutes=1)
    after = client.get("/v1/business/plan", headers=auth(token)).json()
    assert (after["plan"], after["trial_available"]) == ("pay_per_use", False)
    assert "trial_ended" in [n["kind"] for n in client.get("/v1/notifications", headers=auth(token)).json()]


def test_founders_free_monthly_plan_ends_after_three_months(client, conn, clock):
    token, kafe = business_at(client, conn, plan="pay_per_use")
    conn.execute(
        "INSERT INTO venue_profiles (venue_id, founder, founder_until) VALUES (%s, true, %s)", (kafe, clock.now + timedelta(days=90))
    )
    assert client.get("/v1/business/plan", headers=auth(token)).json()["next_campaign"] == "founder"
    clock.now += timedelta(days=91)
    assert client.get("/v1/business/plan", headers=auth(token)).json()["next_campaign"] == "unverified"
    assert "founder_ended" in [n["kind"] for n in client.get("/v1/notifications", headers=auth(token)).json()]


def test_month_report_and_sales_numbers(client, conn, clock):
    token, kafe = business_at(client, conn)
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    checkin(client, ali, kafe)
    checkin(client, ayse, kafe)
    report = client.get("/v1/business/report", headers=auth(token)).json()
    assert (report["checkins"], report["people"], report["new_people"]) == (2, 2, 2)
    admin = account(client, "t_admin")
    conn.execute("UPDATE users SET is_admin = true WHERE username = 't_admin'")
    assert client.get(f"/v1/admin/venues/{kafe}/pitch", headers=auth(ali)).status_code == 403
    pitch = client.get(f"/v1/admin/venues/{kafe}/pitch", headers=auth(admin)).json()
    assert (pitch["week_checkins"], pitch["week_people"], pitch["joined"]) == (2, 2, True)
    assert pitch["busiest_hour"] is not None


def test_founder_applications(client, conn):
    body = {"kind": "business", "contact": "kafe@example.test", "venue_name": "Moda Kahve", "founder": True}
    assert client.post("/v1/waitlist", json=body).status_code == 204
    row = conn.execute("SELECT founder FROM waitlist WHERE contact = 'kafe@example.test'").fetchone()
    assert row["founder"] is True
