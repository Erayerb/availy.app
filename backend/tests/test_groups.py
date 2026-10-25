from tests.test_business import account, auth
from tests.test_checkin_social import befriend


def test_create_invite_join_and_rank(client, conn):
    ali, ayse, can = account(client, "t_ali"), account(client, "t_ayse"), account(client, "t_can")
    befriend(client, ali, ayse, "t_ali", "t_ayse")
    created = client.post("/v1/groups", json={"name": "  Kadıköy   ekibi ", "usernames": ["t_ayse", "t_yok"]}, headers=auth(ali))
    assert created.status_code == 201 and created.json()["invited"] == ["t_ayse"]
    group = created.json()["id"]
    # Ayşe is invited (and told so in 🔔); she is not in the ranking until she joins
    mine = client.get("/v1/groups", headers=auth(ayse)).json()
    assert [(g["name"], g["status"], g["invited_by"], g["members"]) for g in mine] == [("Kadıköy ekibi", "invited", "t_ali", 1)]
    note = [n for n in client.get("/v1/notifications", headers=auth(ayse)).json() if n["kind"] == "group_invite"][0]
    assert (note["username"], note["body"], note["done"]) == ("t_ali", "Kadıköy ekibi", False)
    assert client.get(f"/v1/leaderboard?scope=group&group={group}", headers=auth(ayse)).status_code == 404
    assert client.post(f"/v1/groups/{group}/join", headers=auth(ayse)).status_code == 204
    board = client.get(f"/v1/leaderboard?scope=group&group={group}", headers=auth(ayse)).json()
    assert sorted(r["username"] for r in board["rows"]) == ["t_ali", "t_ayse"]
    # A member invites someone else; an outsider cannot
    assert client.post(f"/v1/groups/{group}/invite", json={"usernames": ["t_can"]}, headers=auth(ayse)).json() == ["t_can"]
    assert client.post(f"/v1/groups/{group}/invite", json={"usernames": ["t_ali"]}, headers=auth(can)).status_code == 404
    # Can turns it down; when everyone leaves, the group is gone
    client.delete(f"/v1/groups/{group}/membership", headers=auth(can))
    client.delete(f"/v1/groups/{group}/membership", headers=auth(ali))
    client.delete(f"/v1/groups/{group}/membership", headers=auth(ayse))
    assert conn.execute("SELECT 1 FROM groups WHERE id = %s", (group,)).fetchone() is None


def test_group_needs_a_name(client, conn):
    ali = account(client, "t_ali")
    assert client.post("/v1/groups", json={"name": "  "}, headers=auth(ali)).status_code == 400
