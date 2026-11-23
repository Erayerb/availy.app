"""İşletme paketleri: free plan 3 campaigns a month once verified; monthly plan unlimited,
with statistics and schedules; founder venues everything."""
from datetime import timedelta

from tests.test_business import auth, business_at
from tests.test_campaigns import CAMPAIGN
from tests.test_checkins import clock  # noqa: F401 (clock is a fixture)


def access(client, token):
    return client.get("/v1/business/plan", headers=auth(token)).json()


def test_free_plan_has_three_campaigns_a_month_once_verified_and_no_statistics(client, conn, clock):
    token, kafe = business_at(client, conn, plan="pay_per_use")
    # Not verified: no campaigns yet
    assert access(client, token)["next_campaign"] == "unverified"
    first = client.post("/v1/campaigns", json=CAMPAIGN, headers=auth(token))
    assert first.status_code == 402 and "doğrula" in first.json()["detail"]
    conn.execute("INSERT INTO venue_profiles (venue_id, verified) VALUES (%s, true)", (kafe,))
    got = access(client, token)
    assert (got["plan"], got["stats"], got["next_campaign"], got["free_campaigns_left"]) == ("pay_per_use", False, "free", 3)
    locked = client.get(f"/v1/venues/{kafe}/stats", headers=auth(token))
    assert locked.status_code == 402 and "aylık pakette" in locked.json()["detail"]
    schedule = {"message": "Hafta içi öğle indirimi", "discount": 10, "radius_km": 2, "days": [0], "start_hour": 12, "duration_hours": 2}
    assert client.post("/v1/business/schedules", json=schedule, headers=auth(token)).status_code == 402
    for _ in range(3):
        assert client.post("/v1/campaigns", json=CAMPAIGN, headers=auth(token)).status_code == 201
    fourth = client.post("/v1/campaigns", json=CAMPAIGN, headers=auth(token))
    assert fourth.status_code == 402 and "Aylık paket" in fourth.json()["detail"]
    assert access(client, token)["next_campaign"] == "blocked"
    # Next month: three again
    clock.now += timedelta(days=32)
    assert access(client, token)["free_campaigns_left"] == 3
    # The monthly plan: unlimited, statistics open
    assert client.put("/v1/business/plan", json={"plan": "saas"}, headers=auth(token)).json()["stats"] is True
    assert client.get(f"/v1/venues/{kafe}/stats", headers=auth(token)).status_code == 200


def test_founder_venues_pay_nothing(client, conn, clock):
    token, kafe = business_at(client, conn, plan="pay_per_use")
    conn.execute("INSERT INTO venue_profiles (venue_id, founder) VALUES (%s, true)", (kafe,))
    got = access(client, token)
    assert (got["stats"], got["next_campaign"]) == (True, "founder")
