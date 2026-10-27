from tests.test_business import account, auth
from tests.test_checkin_social import befriend
from tests.test_checkins import venue_id


def test_lists_private_friends_and_link(client, conn):
    ali, ayse, can = account(client, "t_ali"), account(client, "t_ayse"), account(client, "t_can")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    kafe, cowork = venue_id(conn, "Test Kafe A"), venue_id(conn, "Test Cowork B")
    created = client.post("/v1/lists", json={"name": " Ders   çalışılacak yerler "}, headers=auth(ali)).json()
    assert (created["name"], created["visibility"], created["venue_ids"]) == ("Ders çalışılacak yerler", "private", [])
    lid = created["id"]
    client.put(f"/v1/lists/{lid}/venues/{kafe}", json={"present": True}, headers=auth(ali))
    shown = client.put(f"/v1/lists/{lid}/venues/{cowork}", json={"present": True}, headers=auth(ali)).json()
    assert shown["venue_ids"] == [cowork, kafe]  # newest first
    # Private: nobody else sees it, a friend neither
    assert client.get(f"/v1/lists/{lid}", headers=auth(ayse)).status_code == 404
    assert client.get("/v1/users/t_ali/lists", headers=auth(ayse)).json() == []
    # For friends: Ayşe sees it on the profile, Can (not a friend) does not; only the owner gets the code
    client.patch(f"/v1/lists/{lid}", json={"visibility": "friends"}, headers=auth(ali))
    assert [l["name"] for l in client.get("/v1/users/t_ali/lists", headers=auth(ayse)).json()] == ["Ders çalışılacak yerler"]
    assert client.get(f"/v1/lists/{lid}", headers=auth(ayse)).json()["share_code"] is None
    assert client.get(f"/v1/lists/{lid}", headers=auth(can)).status_code == 404
    # By link: Can opens it with the code and saves a copy of his own
    code = client.get(f"/v1/lists/{lid}", headers=auth(ali)).json()["share_code"]
    assert client.get(f"/v1/lists/shared/{code}", headers=auth(can)).status_code == 404  # still "friends"
    client.patch(f"/v1/lists/{lid}", json={"visibility": "link"}, headers=auth(ali))
    assert client.get(f"/v1/lists/shared/{code.lower()}", headers=auth(can)).json()["venue_ids"] == [cowork, kafe]
    copy = client.post(f"/v1/lists/{lid}/save?code={code}", headers=auth(can)).json()
    assert (copy["mine"], copy["visibility"], sorted(copy["venue_ids"])) == (True, "private", sorted([kafe, cowork]))
    # Others cannot change it; the owner can take a venue out and delete the list
    assert client.put(f"/v1/lists/{lid}/venues/{kafe}", json={"present": False}, headers=auth(can)).status_code == 404
    assert client.put(f"/v1/lists/{lid}/venues/{kafe}", json={"present": False}, headers=auth(ali)).json()["venue_ids"] == [cowork]
    client.delete(f"/v1/lists/{lid}", headers=auth(ali))
    assert client.get("/v1/lists", headers=auth(ali)).json() == []


def test_list_needs_a_name(client, conn):
    ali = account(client, "t_ali")
    assert client.post("/v1/lists", json={"name": " "}, headers=auth(ali)).status_code == 400
