from datetime import timedelta

from tests.test_business import account, auth, business_at
from tests.test_checkins import NOON, clock  # noqa: F401 (clock is a fixture)

CAMPAIGN = {"message": "Önümüzdeki 2 saat tüm kahvelerde %20 indirim", "discount": 20, "radius_km": 2, "duration_hours": 2}


def test_business_campaign_reaches_every_customer(client, conn, clock):
    token, kafe = business_at(client, conn)
    created = client.post("/v1/campaigns", json={**CAMPAIGN, "max_claims": 1}, headers=auth(token))
    assert created.status_code == 201 and created.json()["venue_name"] == "Test Kafe A"
    campaign_id = created.json()["id"]
    # Seen from any phone, even without signing in
    running = client.get("/v1/campaigns").json()
    assert [c["id"] for c in running] == [campaign_id] and running[0]["claims"] == 0
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    client.post(f"/v1/campaigns/{campaign_id}/view", headers=auth(ali))
    client.post(f"/v1/campaigns/{campaign_id}/view", headers=auth(ali))  # once per person
    coupon = client.post(f"/v1/campaigns/{campaign_id}/coupon", headers=auth(ali)).json()
    assert coupon["code"].startswith("AV-") and coupon["redeemed_at"] is None
    assert client.post(f"/v1/campaigns/{campaign_id}/coupon", headers=auth(ali)).json()["code"] == coupon["code"]
    full = client.post(f"/v1/campaigns/{campaign_id}/coupon", headers=auth(ayse))
    assert full.status_code == 409 and "sınırı" in full.json()["detail"]
    assert [c["code"] for c in client.get("/v1/me/coupons", headers=auth(ali)).json()] == [coupon["code"]]

    # At the counter
    rival, _ = business_at(client, conn, "t_rakip", "Test Cowork B")
    assert client.post("/v1/coupons/redeem", json={"code": coupon["code"]}, headers=auth(rival)).status_code == 403
    used = client.post("/v1/coupons/redeem", json={"code": f" {coupon['code'].lower()} "}, headers=auth(token))
    assert used.status_code == 200 and used.json()["redeemed_at"] is not None
    assert client.post("/v1/coupons/redeem", json={"code": coupon["code"]}, headers=auth(token)).status_code == 409
    assert client.post("/v1/coupons/redeem", json={"code": "AV-ZZZZ"}, headers=auth(token)).status_code == 404
    stats = client.get("/v1/me/campaigns", headers=auth(token)).json()[0]
    assert (stats["views"], stats["claims"], stats["redemptions"]) == (1, 1, 1)
    assert len(client.get("/v1/me/coupons", headers=auth(token)).json()) == 1  # the business sees its coupons


def test_end_hide_and_rules(client, conn, clock):
    token, kafe = business_at(client, conn)
    ali = account(client, "t_ali")
    assert client.post("/v1/campaigns", json=CAMPAIGN, headers=auth(ali)).status_code == 403
    assert client.post("/v1/campaigns", json={**CAMPAIGN, "message": "kısa"}, headers=auth(token)).status_code == 400
    assert client.post("/v1/campaigns", json={**CAMPAIGN, "radius_km": 50}, headers=auth(token)).status_code == 400
    campaign_id = client.post("/v1/campaigns", json=CAMPAIGN, headers=auth(token)).json()["id"]
    assert client.post(f"/v1/campaigns/{campaign_id}/coupon", headers=auth(token)).status_code == 403
    coupon = client.post(f"/v1/campaigns/{campaign_id}/coupon", headers=auth(ali)).json()["code"]
    assert not set(coupon[3:]) & set("0O1I8B")
    # Only ended campaigns can be removed from the list
    client.post("/v1/campaigns/hide", json={"ids": [campaign_id]}, headers=auth(token))
    assert len(client.get("/v1/me/campaigns", headers=auth(token)).json()) == 1
    rival, _ = business_at(client, conn, "t_rakip", "Test Cowork B")
    assert client.post(f"/v1/campaigns/{campaign_id}/end", headers=auth(rival)).status_code == 404
    ended = client.post(f"/v1/campaigns/{campaign_id}/end", headers=auth(token)).json()
    assert client.get("/v1/campaigns").json() == []
    assert client.post(f"/v1/campaigns/{campaign_id}/coupon", headers=auth(account(client, "t_ayse"))).status_code == 409
    late = client.post("/v1/coupons/redeem", json={"code": coupon}, headers=auth(token))
    assert late.status_code == 409 and "bitti" in late.json()["detail"]
    clock.now = NOON + timedelta(minutes=1)
    client.post("/v1/campaigns/hide", json={"ids": [ended["id"]]}, headers=auth(token))
    assert client.get("/v1/me/campaigns", headers=auth(token)).json() == []
