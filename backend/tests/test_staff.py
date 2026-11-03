from datetime import datetime, timezone

from tests.test_business import account, auth, business_at
from tests.test_checkins import checkin, clock, venue_id  # noqa: F401 (clock is a fixture)


def test_a_business_invites_staff_who_only_work_the_counter(client, conn, clock):
    business, kafe = business_at(client, conn)
    ali, musteri = account(client, "t_ali"), account(client, "t_musteri")
    assert client.post("/v1/staff/invite", headers=auth(ali)).status_code == 403  # only a business
    code = client.post("/v1/staff/invite", headers=auth(business)).json()["code"]
    # Join with the code (once); a wrong one fails
    assert client.post("/v1/staff/join", json={"code": "CK-YANLIS"}, headers=auth(ali)).status_code == 404
    assert client.get("/v1/staff/me", headers=auth(ali)).json() is None
    joined = client.post("/v1/staff/join", json={"code": code.lower()}, headers=auth(ali)).json()
    assert joined["venue_id"] == kafe
    assert client.post("/v1/staff/join", json={"code": code}, headers=auth(musteri)).status_code == 404

    # The counter: stamps work; the program itself and the campaigns stay the business's
    client.put("/v1/me/loyalty", json={"kind": "stamps", "stamps_required": 5, "reward": "1 kahve"}, headers=auth(business))
    client.post(f"/v1/loyalty/{kafe}/join", headers=auth(musteri))
    m_code = client.get("/v1/me", headers=auth(musteri)).json()["customer_code"]
    assert client.post("/v1/me/loyalty/stamp", json={"code": m_code}, headers=auth(ali)).status_code == 200
    assert client.get("/v1/me/loyalty", headers=auth(ali)).status_code == 403
    # Not on their own card, and no check-in at their workplace
    a_code = client.get("/v1/me", headers=auth(ali)).json()["customer_code"]
    client.post(f"/v1/loyalty/{kafe}/join", headers=auth(ali))
    assert client.post("/v1/me/loyalty/stamp", json={"code": a_code}, headers=auth(ali)).status_code == 403
    assert checkin(client, ali, kafe).status_code == 403

    # The owner sees who did what, and removes them: the counter closes
    [row] = client.get("/v1/staff", headers=auth(business)).json()
    assert (row["username"], row["stamps"]) == ("t_ali", 1)
    assert client.delete(f"/v1/staff/{row['id']}", headers=auth(business)).status_code == 204
    assert client.post("/v1/me/loyalty/stamp", json={"code": m_code}, headers=auth(ali)).status_code == 403
    assert client.get("/v1/staff", headers=auth(business)).json() == []
    assert client.get("/v1/staff/me", headers=auth(ali)).json() is None


def test_an_expired_code_does_not_work(client, conn, clock):
    business, _ = business_at(client, conn)
    code = client.post("/v1/staff/invite", headers=auth(business)).json()["code"]
    conn.execute("UPDATE staff_invites SET expires_at = %s WHERE code = %s", (datetime(2000, 1, 1, tzinfo=timezone.utc), code))
    assert client.post("/v1/staff/join", json={"code": code}, headers=auth(account(client, "t_ali"))).status_code == 404


def test_staff_can_leave_on_their_own(client, conn, clock):
    business, _ = business_at(client, conn)
    ali = account(client, "t_ali")
    code = client.post("/v1/staff/invite", headers=auth(business)).json()["code"]
    assert client.post("/v1/staff/join", json={"code": code}, headers=auth(ali)).status_code == 200
    assert client.delete("/v1/staff/me", headers=auth(ali)).status_code == 204
    assert client.get("/v1/staff/me", headers=auth(ali)).json() is None
    assert client.get("/v1/staff", headers=auth(business)).json() == []


def test_the_code_is_short_and_cannot_be_guessed(client, conn, clock):
    business, _ = business_at(client, conn)
    ali = account(client, "t_ali")
    code = client.post("/v1/staff/invite", headers=auth(business)).json()["code"]
    assert len(code) == 5
    for _ in range(10):
        assert client.post("/v1/staff/join", json={"code": "YANLIS"}, headers=auth(ali)).status_code == 404
    # Even the right code waits now
    assert client.post("/v1/staff/join", json={"code": code}, headers=auth(ali)).status_code == 429
