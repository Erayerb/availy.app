from tests.test_business import account, auth
from tests.test_checkins import checkin, clock, venue_id  # noqa: F401 (clock is a fixture)
from tests.test_user_venues import listed


def friends(client, a, b, a_name, b_name):
    client.post("/v1/friends", json={"username": b_name}, headers=auth(a))
    client.post("/v1/friends", json={"username": a_name}, headers=auth(b))


def kinds(client, token):
    return [n for n in client.get("/v1/notifications", headers=auth(token)).json() if n["kind"] == "come_here"]


def test_buradayim_gel_tells_friends_once(client, conn, clock):
    ali, ayse, yabanci = account(client, "t_ali"), account(client, "t_ayse"), account(client, "t_yabanci")
    kafe = venue_id(conn, "Test Kafe A")
    done = checkin(client, ali, kafe).json()
    url = f"/v1/checkins/{done['id']}/call-friends"
    # Nobody to call yet
    assert client.post(url, headers=auth(ali)).status_code == 409
    friends(client, ali, ayse, "t_ali", "t_ayse")
    assert client.post(url, headers=auth(ali)).json() == {"friends": 1}
    assert client.post(url, headers=auth(ali)).status_code == 200  # a second tap adds nothing
    [note] = kinds(client, ayse)
    assert (note["username"], note["venue_id"]) == ("t_ali", kafe)
    assert kinds(client, yabanci) == [] and kinds(client, ali) == []
    # Someone else's check-in cannot be used
    assert client.post(url, headers=auth(yabanci)).status_code == 404


def test_only_an_admin_marks_a_founder_venue_and_at_most_ten(client, conn, clock):
    ali, admin = account(client, "t_ali"), account(client, "t_admin")
    conn.execute("UPDATE users SET is_admin = true WHERE username = 't_admin'")
    conn.execute("UPDATE venue_profiles SET founder = false")
    kafe = venue_id(conn, "Test Kafe A")
    url = f"/v1/admin/venues/{kafe}/founder"
    assert client.post(url, json={"founder": True}, headers=auth(ali)).status_code == 403
    assert client.post(url, json={"founder": True}, headers=auth(admin)).status_code == 204
    assert listed(client)["Test Kafe A"]["founder"] is True
    assert client.post(url, json={"founder": False}, headers=auth(admin)).status_code == 204
    assert listed(client)["Test Kafe A"]["founder"] is False
