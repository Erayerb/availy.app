import base64

from tests.conftest import KADIKOY_BBOX
from tests.test_business import account, auth, business_at

PIXEL = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 50).decode()


def kafe_out(client):
    return {v["name"]: v for v in client.get("/v1/venues", params={"bbox": KADIKOY_BBOX}).json()}["Test Kafe A"]


def test_business_profile_on_the_venue_page(client, conn):
    token, kafe = business_at(client, conn)
    assert kafe_out(client)["photo_at"] is None and kafe_out(client)["verified"] is False
    saved = client.put(
        f"/v1/venues/{kafe}/profile", json={"instagram": "https://instagram.com/testkafe/", "phone": "0216 123 45 67"}, headers=auth(token)
    )
    assert saved.status_code == 200 and saved.json() == {"instagram": "testkafe", "phone": "0216 123 45 67"}
    assert client.put(f"/v1/venues/{kafe}/profile", json={"phone": "12"}, headers=auth(token)).status_code == 400
    assert client.put(f"/v1/venues/{kafe}/profile", json={"instagram": "kötü ad"}, headers=auth(token)).status_code == 400
    assert client.put(f"/v1/venues/{kafe}/photo", json={"photo": PIXEL}, headers=auth(token)).status_code == 200
    assert client.put(f"/v1/venues/{kafe}/photo", json={"photo": "data:text/html;base64,PGI+"}, headers=auth(token)).status_code == 400
    shown = kafe_out(client)
    assert shown["instagram"] == "testkafe" and shown["phone"] == "0216 123 45 67" and shown["photo_at"] is not None
    picture = client.get(f"/v1/venues/{kafe}/photo")
    assert picture.status_code == 200 and picture.headers["content-type"] == "image/png"
    # Only the venue's own business
    rival, _ = business_at(client, conn, "t_rakip", "Test Cowork B")
    customer = account(client, "t_ali")
    for other in (rival, customer):
        assert client.put(f"/v1/venues/{kafe}/profile", json={"phone": ""}, headers=auth(other)).status_code == 403
    # Cleared links
    client.put(f"/v1/venues/{kafe}/profile", json={}, headers=auth(token))
    assert kafe_out(client)["instagram"] is None


def test_business_corrects_address_and_map_point(client, conn):
    token, kafe = business_at(client, conn)
    body = {"address": "Moda Cd. No: 12", "neighborhood": "Caferağa", "district": "Kadıköy", "lat": 40.9845, "lon": 29.0262}
    saved = client.put(f"/v1/venues/{kafe}/address", json=body, headers=auth(token))
    assert saved.status_code == 200 and saved.json()["neighborhood"] == "Caferağa"
    shown = kafe_out(client)
    assert (shown["address"], shown["neighborhood"], shown["lat"]) == ("Moda Cd. No: 12", "Caferağa", 40.9845)
    assert conn.execute("SELECT edited_by_business FROM venues WHERE id = %s", (kafe,)).fetchone()["edited_by_business"]
    far = client.put(f"/v1/venues/{kafe}/address", json={**body, "lat": 41.05}, headers=auth(token))
    assert far.status_code == 400 and "1 km" in far.json()["detail"]
    assert client.put(f"/v1/venues/{kafe}/address", json={**body, "district": " "}, headers=auth(token)).status_code == 400
    customer = account(client, "t_ali")
    assert client.put(f"/v1/venues/{kafe}/address", json=body, headers=auth(customer)).status_code == 403


def test_business_edits_venue_details_for_everyone(client, conn):
    token, kafe = business_at(client, conn)
    other = account(client, "t_ali")
    body = {"name": " Kafe   Moda ", "open_hour": 7, "close_hour": 2, "tags": ["quiet", "wifi"], "amenities": ["power"], "description": "Bahçeli"}
    assert client.put(f"/v1/venues/{kafe}/details", json=body, headers=auth(other)).status_code == 403
    assert client.put(f"/v1/venues/{kafe}/details", json={**body, "close_hour": 7}, headers=auth(token)).status_code == 400
    assert client.put(f"/v1/venues/{kafe}/details", json={**body, "amenities": ["havuz"]}, headers=auth(token)).status_code == 400
    assert client.put(f"/v1/venues/{kafe}/details", json=body, headers=auth(token)).status_code == 204
    shown = {v["id"]: v for v in client.get("/v1/venues", params={"bbox": KADIKOY_BBOX}).json()}[kafe]
    assert (shown["name"], shown["hours"], sorted(shown["tags"])) == ("Kafe Moda", "07:00–02:00", ["quiet", "wifi"])
    assert (shown["amenity_keys"], shown["description"]) == (["power"], "Bahçeli")


def test_profile_photo(client, conn):
    token = account(client, "t_ali")
    assert client.get("/v1/users/t_ali/photo").status_code == 404
    assert client.put("/v1/me/photo", json={"photo": "data:text/html;base64,PGI+"}, headers=auth(token)).status_code == 400
    saved = client.put("/v1/me/photo", json={"photo": PIXEL}, headers=auth(token))
    assert saved.status_code == 200
    shown = client.get("/v1/users/t_ali/photo")
    assert shown.status_code == 200 and shown.headers["content-type"] == "image/png"
    assert client.get("/v1/users/t_ali", headers=auth(token)).json()["photo_at"] is not None
    client.delete("/v1/me/photo", headers=auth(token))
    assert client.get("/v1/users/t_ali/photo").status_code == 404
