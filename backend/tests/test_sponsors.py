from tests.test_business import account, auth, business_at


def by_id(client, venue_id):
    return client.get("/v1/venues/search", params={"ids": str(venue_id)}).json()[0]


def test_a_business_asks_the_admin_switches_it_on_and_the_card_is_counted(client, conn):
    token, kafe = business_at(client, conn)
    admin = account(client, "t_yonetici")
    conn.execute("UPDATE users SET is_admin = true WHERE username = 't_yonetici'")
    customer = account(client, "t_ali")

    assert client.get("/v1/business/sponsorship", headers=auth(customer)).status_code == 403
    asked = client.post("/v1/business/sponsorship", json={"days": 7}, headers=auth(token)).json()
    assert asked["active"] is None and asked["requested_days"] == 7
    assert by_id(client, kafe)["sponsored"] is False
    # Views before it runs are not counted
    client.post(f"/v1/venues/{kafe}/sponsor-events", json={"kind": "view"})

    assert client.get("/v1/admin/sponsorships", headers=auth(customer)).status_code == 403
    overview = client.get("/v1/admin/sponsorships", headers=auth(admin)).json()
    assert [r["venue_id"] for r in overview["requests"]] == [kafe]
    assert client.post(f"/v1/admin/sponsorships/{kafe}", json={"days": 7}, headers=auth(admin)).status_code == 204
    assert by_id(client, kafe)["sponsored"] is True
    overview = client.get("/v1/admin/sponsorships", headers=auth(admin)).json()
    assert overview["requests"] == [] and [a["venue_id"] for a in overview["active"]] == [kafe]

    for kind in ("view", "view", "tap"):
        client.post(f"/v1/venues/{kafe}/sponsor-events", json={"kind": kind})
    status = client.get("/v1/business/sponsorship", headers=auth(token)).json()
    assert status["active"] and status["requested_days"] is None
    assert (status["views"], status["taps"]) == (2, 1)

    # Stopped: no longer first
    assert client.delete(f"/v1/admin/sponsorships/{kafe}", headers=auth(admin)).status_code == 204
    assert by_id(client, kafe)["sponsored"] is False


def test_only_7_or_30_days(client, conn):
    token, _ = business_at(client, conn)
    assert client.post("/v1/business/sponsorship", json={"days": 3}, headers=auth(token)).status_code == 422
