from datetime import timedelta

from tests.test_business import account, auth, business_at
from tests.test_checkins import NOON, clock  # noqa: F401 (clock is a fixture)

def give_points(conn, username, amount=500):
    conn.execute(
        "INSERT INTO points (user_id, amount, reason) SELECT id, %s, 'checkin' FROM users WHERE username = %s", (amount, username)
    )


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
    give_points(conn, "t_ali")
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
    give_points(conn, "t_ali")
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


def test_coupon_for_checking_in(client, conn, clock):
    from tests.test_checkins import checkin

    token, kafe = business_at(client, conn)
    body = {**CAMPAIGN, "checkin_only": True, "max_claims": 1}
    campaign = client.post("/v1/campaigns", json=body, headers=auth(token)).json()
    assert campaign["checkin_only"] is True
    ali, ayse = account(client, "t_ali"), account(client, "t_ayse")
    early = client.post(f"/v1/campaigns/{campaign['id']}/coupon", headers=auth(ali))
    assert early.status_code == 403 and "check-in" in early.json()["detail"]
    done = checkin(client, ali, kafe).json()
    assert len(done["coupons"]) == 1 and done["coupons"][0]["code"].startswith("AV-")
    assert client.get("/v1/me/coupons", headers=auth(ali)).json()[0]["code"] == done["coupons"][0]["code"]
    # The limit is reached: the next check-in gets no coupon, the check-in itself works
    second = checkin(client, ayse, kafe)
    assert second.status_code == 201 and second.json()["coupons"] == []


def test_business_request(client, conn):
    from app import mailer
    from tests.test_checkins import venue_id

    cowork = venue_id(conn, "Test Cowork B")
    conn.execute("UPDATE venues SET contact_email = 'cowork@example.test' WHERE id = %s", (cowork,))
    mailer.outbox.clear()
    people = [account(client, f"t_istek{i}") for i in range(10)]
    first = client.post(f"/v1/venues/{cowork}/business-request", headers=auth(people[0])).json()
    assert first == {"has_business": False, "count": 1, "mine": True}
    client.post(f"/v1/venues/{cowork}/business-request", headers=auth(people[0]))  # once per person
    for token in people[1:]:
        client.post(f"/v1/venues/{cowork}/business-request", headers=auth(token))
    mails = [m for m in mailer.outbox if m["to"] == ["cowork@example.test"]]
    assert [m["subject"].split()[0] for m in mails] == ["3", "5", "10"]
    assert not any(f"t_istek{i}" in m["text"] for m in mails for i in range(10))  # never who asked
    assert client.get(f"/v1/venues/{cowork}/business-request").json()["count"] == 10
    _, kafe = business_at(client, conn)
    assert client.post(f"/v1/venues/{kafe}/business-request", headers=auth(people[0])).status_code == 409


def test_coupons_are_free_unless_the_business_makes_them_special(client, conn, clock):
    token, _ = business_at(client, conn)
    ali = account(client, "t_ali")
    usual = client.post("/v1/campaigns", json=CAMPAIGN, headers=auth(token)).json()
    assert usual["points_price"] == 0
    assert client.post(f"/v1/campaigns/{usual['id']}/coupon", headers=auth(ali)).status_code == 200
    assert client.get("/v1/me/points", headers=auth(ali)).json() == {"balance": 0}
    # "Puanla açılan özel kupon": only the set prices, never for check-in coupons
    assert client.post("/v1/campaigns", json={**CAMPAIGN, "points_price": 77}, headers=auth(token)).status_code == 400
    assert client.post("/v1/campaigns", json={**CAMPAIGN, "points_price": 100, "checkin_only": True}, headers=auth(token)).status_code == 400
    special = client.post("/v1/campaigns", json={**CAMPAIGN, "discount": 40, "points_price": 100}, headers=auth(token)).json()
    poor = client.post(f"/v1/campaigns/{special['id']}/coupon", headers=auth(ali))
    assert poor.status_code == 402 and "100 puan" in poor.json()["detail"]
    give_points(conn, "t_ali", 150)
    assert client.post(f"/v1/campaigns/{special['id']}/coupon", headers=auth(ali)).status_code == 200
    client.post(f"/v1/campaigns/{special['id']}/coupon", headers=auth(ali))  # the same coupon, not paid twice
    assert client.get("/v1/me/points", headers=auth(ali)).json() == {"balance": 50}
    # Spending does not lower the level or the ranking: those count what was earned
    assert conn.execute("SELECT sum(amount)::int AS n FROM points p JOIN users u ON u.id = p.user_id WHERE u.username = 't_ali'").fetchone()["n"] == 150
    # The business ends it early: the unused coupon's points come back
    client.post(f"/v1/campaigns/{special['id']}/end", headers=auth(token))
    assert client.get("/v1/me/points", headers=auth(ali)).json() == {"balance": 150}
