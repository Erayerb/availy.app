from datetime import timedelta

from tests.conftest import KADIKOY_BBOX
from tests.test_business import account, auth, business_at
from tests.test_checkins import NOON, clock  # noqa: F401 (clock is a fixture)

# About 400 m from the test venues, inside KADIKOY_BBOX
SPOT = {"lat": 40.9900, "lon": 29.0200}
NEW = {
    "name": "Yeni Kahveci", "category": "cafe", **SPOT, "neighborhood": "Moda", "district": "Kadıköy",
    "address": "Moda Cd. 5", "user_lat": SPOT["lat"], "user_lon": SPOT["lon"],
}


def listed(client):
    return {v["name"]: v for v in client.get("/v1/venues", params={"bbox": KADIKOY_BBOX}).json()}


def test_add_a_venue_and_approve_it_with_checkins(client, conn, clock):
    ali = account(client, "t_ali")
    guest = client.post("/v1/auth/guest").json()["token"]
    assert client.post("/v1/venues", json=NEW, headers=auth(guest)).status_code == 403
    far = client.post("/v1/venues", json={**NEW, "user_lat": SPOT["lat"] + 0.05}, headers=auth(ali))
    assert far.status_code == 403 and "yakın" in far.json()["detail"]
    assert client.post("/v1/venues", json={k: v for k, v in NEW.items() if k != "user_lat"}, headers=auth(ali)).status_code == 400
    assert client.post("/v1/venues", json={**NEW, "category": "uzay"}, headers=auth(ali)).status_code == 400
    added = client.post("/v1/venues", json=NEW, headers=auth(ali))
    assert added.status_code == 201
    venue_id = added.json()["id"]
    assert listed(client)["Yeni Kahveci"]["pending"] is True and listed(client)["Yeni Kahveci"]["address"] == "Moda Cd. 5"
    # The same place again
    again = client.post("/v1/venues", json={**NEW, "name": "yeni kahveci"}, headers=auth(ali))
    assert again.status_code == 409 and "Yeni Kahveci" in again.json()["detail"]

    # The one who added it does not count; three other people on three days do
    people = [account(client, f"t_kisi{i}") for i in range(3)]
    body = {"level": "low", **SPOT}
    client.post(f"/v1/venues/{venue_id}/checkins", json=body, headers=auth(ali))
    points_before = client.get("/v1/me", headers=auth(ali)).json()["points"]
    for day, token in enumerate(people):
        clock.now = NOON + timedelta(days=day)
        assert client.post(f"/v1/venues/{venue_id}/checkins", json=body, headers=auth(token)).status_code == 201
        approved = conn.execute("SELECT approved_at FROM venues WHERE id = %s", (venue_id,)).fetchone()["approved_at"]
        assert (approved is not None) == (day == 2)
    assert listed(client)["Yeni Kahveci"]["pending"] is False
    assert client.get("/v1/me", headers=auth(ali)).json()["points"] == points_before + 50


def test_unapproved_venues_go_after_30_days_and_limits(client, conn, clock):
    ali = account(client, "t_ali")
    for i in range(3):
        spot = {"lat": SPOT["lat"] + i * 0.01, "lon": SPOT["lon"], "user_lat": SPOT["lat"] + i * 0.01}
        assert client.post("/v1/venues", json={**NEW, "name": f"Mekan {i}", **spot}, headers=auth(ali)).status_code == 201
    assert client.post("/v1/venues", json={**NEW, "name": "Dördüncü"}, headers=auth(ali)).status_code == 429
    conn.execute("UPDATE venues SET created_at = now() - interval '31 days' WHERE name = 'Mekan 0'")
    names = {v["name"] for v in client.get("/v1/venues/search", params={"q": "mekan"}).json()}
    assert names == {"Mekan 1", "Mekan 2"}


def test_a_business_adds_its_own_venue_from_anywhere(client, conn):
    from tests.test_business import account as make

    token = make(client, "t_yeniisletme", "business")
    body = {k: v for k, v in NEW.items() if not k.startswith("user_")}
    added = client.post("/v1/venues", json=body, headers=auth(token))
    assert added.status_code == 201
    assert client.get("/v1/me", headers=auth(token)).json()["venue_id"] == added.json()["id"]
    assert client.post("/v1/venues", json={**body, "name": "İkinci"}, headers=auth(token)).status_code == 409


def test_a_venue_right_next_to_another_asks_first(client, conn):
    ali = account(client, "t_ali")
    assert client.post("/v1/venues", json=NEW, headers=auth(ali)).status_code == 201
    beside = {**NEW, "name": "Başka Kafe", "lat": SPOT["lat"] + 0.00003, "user_lat": SPOT["lat"]}
    warned = client.post("/v1/venues", json=beside, headers=auth(ali))
    assert warned.status_code == 409 and "Yine de ekle" in warned.json()["detail"] and "Yeni Kahveci" in warned.json()["detail"]
    assert client.post("/v1/venues", json={**beside, "confirm_near": True}, headers=auth(ali)).status_code == 201
