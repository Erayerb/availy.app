import pytest

from app.name_check import name_problem
from tests.test_business import account, auth, business_at
from tests.test_user_venues import NEW, listed
from tests.test_checkins import clock  # noqa: F401 (clock is a fixture)


@pytest.mark.parametrize("name", [
    "Moda Kahve Evi", "BAP", "Got Coffee", "Pic Nic", "Sikke Kafe", "Amcam Kebap", "Kafe 212", "Çiğdem'in Yeri", "Cafe & Bistro", "Kasık Pastanesi",
])
def test_ordinary_names_pass(name):
    assert name_problem(name) is None


@pytest.mark.parametrize("name", [
    "www.kafem.com", "kafem.com", "https://x.y", "@kafem", "0532 123 45 67", "MODA KAHVE EVİ", "Orospu Kafe", "0r0ssspu", "Sik Kafe", "Göt Kafe", "Yarrak Bar",
])
def test_bad_names_do_not(name):
    assert name_problem(name)


def user_venue(client, ali, name="Yeni Kahveci"):
    assert client.post("/v1/venues", json={**NEW, "name": name}, headers=auth(ali)).status_code == 201
    return listed(client)[name]["id"]


def test_adding_and_renaming_are_checked(client, conn, clock):
    ali = account(client, "t_ali")
    bad = client.post("/v1/venues", json={**NEW, "name": "www.kafem.com"}, headers=auth(ali))
    assert bad.status_code == 400 and "bağlantı" in bad.json()["detail"]
    business, kafe = business_at(client, conn)
    body = {"name": "www.kafem.com", "open_hour": 8, "close_hour": 22, "tags": []}
    renamed = client.put(f"/v1/venues/{kafe}/details", json=body, headers=auth(business))
    assert renamed.status_code == 400 and "bağlantı" in renamed.json()["detail"]


def test_three_people_hide_a_user_venue_until_an_admin_looks(client, conn, clock):
    ali = account(client, "t_ali")
    kafe = user_venue(client, ali)
    report = lambda token: client.post(f"/v1/venues/{kafe}/issues", json={"kind": "offensive_name"}, headers=auth(token))  # noqa: E731
    # Guests do not count: anyone could make many of them
    for _ in range(3):
        assert report(client.post("/v1/auth/guest").json()["token"]).status_code == 204
    assert "Yeni Kahveci" in listed(client)
    report(account(client, "t_a"))
    report(account(client, "t_b"))
    assert "Yeni Kahveci" in listed(client)
    report(account(client, "t_c"))
    assert "Yeni Kahveci" not in listed(client)
    # The admin says the reports were wrong: it is back
    admin = account(client, "t_admin")
    conn.execute("UPDATE users SET is_admin = true WHERE username = 't_admin'")
    assert client.post(f"/v1/admin/venue-issues/{kafe}/offensive_name", json={"action": "dismiss"}, headers=auth(admin)).status_code == 204
    assert "Yeni Kahveci" in listed(client)


def test_a_venue_from_the_map_data_is_not_hidden_by_reports(client, conn, clock):
    kafe = listed(client)["Test Kafe A"]["id"]
    for name in ("t_a", "t_b", "t_c"):
        client.post(f"/v1/venues/{kafe}/issues", json={"kind": "offensive_name"}, headers=auth(account(client, name)))
    assert "Test Kafe A" in listed(client)


def test_the_admin_renames_or_removes_a_pending_venue(client, conn, clock):
    ali = account(client, "t_ali")
    kafe = user_venue(client, ali)
    url = "/v1/admin/pending-venues"
    assert client.get(url, headers=auth(ali)).status_code == 403
    admin = account(client, "t_admin")
    conn.execute("UPDATE users SET is_admin = true WHERE username = 't_admin'")
    rows = [r for r in client.get(url, headers=auth(admin)).json() if r["id"] == kafe]
    assert rows[0]["name"] == "Yeni Kahveci" and rows[0]["added_by"] == "t_ali"
    assert client.post(f"{url}/{kafe}", json={"action": "rename", "name": "Doğru Ad"}, headers=auth(admin)).status_code == 204
    assert "Doğru Ad" in listed(client)
    assert client.post(f"{url}/{kafe}", json={"action": "remove"}, headers=auth(admin)).status_code == 204
    assert "Doğru Ad" not in listed(client)
    assert [r for r in client.get(url, headers=auth(admin)).json() if r["id"] == kafe] == []
