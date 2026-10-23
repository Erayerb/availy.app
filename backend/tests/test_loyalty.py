from tests.test_business import account, auth, business_at
from tests.test_checkins import NEAR, checkin, clock  # noqa: F401 (clock is a fixture)

STAMPS = {"kind": "stamps", "stamps_required": 2, "reward": "1 kahve bedava"}


def test_customers_join_and_get_stamped(client, conn, clock):
    token, kafe = business_at(client, conn)
    ali = account(client, "t_ali")
    code = client.get("/v1/me", headers=auth(ali)).json()["customer_code"]
    assert code.startswith("M-") and client.get("/v1/me", headers=auth(ali)).json()["customer_code"] == code
    checkin(client, ali, kafe)
    assert client.put("/v1/me/loyalty", json={**STAMPS, "reward": ""}, headers=auth(token)).status_code == 400
    assert client.put("/v1/me/loyalty", json=STAMPS, headers=auth(token)).status_code == 200
    assert client.put("/v1/me/loyalty", json=STAMPS, headers=auth(ali)).status_code == 403
    # Not joined: shown, but no card; a notification because Ali checked in there
    program = client.get("/v1/loyalty", headers=auth(ali)).json()[0]
    assert program["venue_name"] == "Test Kafe A" and program["member"] is None
    note = client.get("/v1/notifications", headers=auth(ali)).json()[0]
    assert note["kind"] == "loyalty" and note["body"] == "2 damga = 1 kahve bedava"
    refused = client.post("/v1/me/loyalty/stamp", json={"code": code}, headers=auth(token))
    assert refused.status_code == 409 and "Katıl" in refused.json()["detail"]
    # Joined: stamps, a full card, the reward used once
    assert client.post(f"/v1/loyalty/{kafe}/join", headers=auth(ali)).status_code == 204
    assert [n["kind"] for n in client.get("/v1/notifications", headers=auth(ali)).json()].count("loyalty") == 0
    assert "1/2" in client.post("/v1/me/loyalty/stamp", json={"code": code}, headers=auth(token)).json()["message"]
    assert "doldu" in client.post("/v1/me/loyalty/stamp", json={"code": code.lower()}, headers=auth(token)).json()["message"]
    member = client.get("/v1/loyalty", headers=auth(ali)).json()[0]["member"]
    assert (member["stamps"], member["rewards"], member["total_stamps"]) == (0, 1, 2)
    assert client.post("/v1/me/loyalty/reward", json={"code": code}, headers=auth(token)).status_code == 200
    assert client.post("/v1/me/loyalty/reward", json={"code": code}, headers=auth(token)).status_code == 409
    assert client.get("/v1/me/loyalty", headers=auth(token)).json()["members"] == 1
    assert client.post("/v1/me/loyalty/stamp", json={"code": "M-000000"}, headers=auth(token)).status_code in (404, 409)
    # Paused: hidden from customers
    client.put("/v1/me/loyalty", json={**STAMPS, "active": False}, headers=auth(token))
    assert client.get("/v1/loyalty", headers=auth(ali)).json() == []


def test_only_customers_who_checked_in_are_notified(client, conn, clock):
    token, kafe = business_at(client, conn)
    stranger = account(client, "t_yabanci")
    client.put("/v1/me/loyalty", json={"kind": "membership", "price": 149, "perk": "Her kahvede %15"}, headers=auth(token))
    assert client.get("/v1/notifications", headers=auth(stranger)).json() == []
    assert client.post(f"/v1/loyalty/{kafe}/join", headers=auth(token)).status_code == 403
