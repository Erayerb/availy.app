from tests.test_business import account, auth, business_at


def test_business_reports_and_the_admin_removes_or_keeps(client, conn, visit):
    business, kafe = business_at(client, conn)
    ali = account(client, "t_ali")
    visit("t_ali", kafe)
    review = client.post(f"/v1/venues/{kafe}/reviews", json={"rating": 1, "body": "Berbat"}, headers=auth(ali)).json()["items"][0]
    # A business cannot delete it, but it can report it
    assert client.delete(f"/v1/reviews/{review['id']}", headers=auth(business)).status_code == 204
    assert client.get(f"/v1/venues/{kafe}/reviews").json()["count"] == 1
    assert client.post(f"/v1/reviews/{review['id']}/report", json={"reason": "false"}, headers=auth(business)).status_code == 204
    # Only admins see the list
    assert client.get("/v1/admin/reports", headers=auth(ali)).status_code == 403
    admin = account(client, "t_yonetici")
    conn.execute("UPDATE users SET is_admin = true WHERE username = 't_yonetici'")
    items = client.get("/v1/admin/reports", headers=auth(admin)).json()
    assert [(i["kind"], i["id"], i["from_business"], i["reasons"]) for i in items] == [("review", review["id"], True, ["false"])]
    # Kept: the report stops hiding it (also for the business) and the item leaves the list
    client.post(f"/v1/admin/review/{review['id']}/dismiss", headers=auth(admin))
    assert client.get("/v1/admin/reports", headers=auth(admin)).json() == []
    assert client.get(f"/v1/venues/{kafe}/reviews", headers=auth(business)).json()["count"] == 1
    # Removed: gone for everyone
    client.post(f"/v1/reviews/{review['id']}/report", json={"reason": "insult"}, headers=auth(account(client, "t_can")))
    assert client.post(f"/v1/admin/review/{review['id']}/remove", headers=auth(admin)).status_code == 204
    assert client.get(f"/v1/venues/{kafe}/reviews").json()["count"] == 0


def test_three_people_report_wrong_info_and_the_admin_checks(client, conn, visit):
    from tests.test_checkins import venue_id

    kafe = venue_id(conn, "Test Kafe A")
    people = [account(client, f"t_kisi{i}") for i in range(3)]
    admin = account(client, "t_yonetici")
    conn.execute("UPDATE users SET is_admin = true WHERE username = 't_yonetici'")
    issues = lambda: client.get("/v1/admin/venue-issues", headers=auth(admin)).json()  # noqa: E731
    # Twice by the same person counts once; 2 people are not enough
    for who in (people[0], people[0], people[1]):
        assert client.post(f"/v1/venues/{kafe}/issues", json={"kind": "closed"}, headers=auth(who)).status_code == 204
    client.post(f"/v1/venues/{kafe}/issues", json={"kind": "name", "note": "Adı Kafe B oldu"}, headers=auth(people[2]))
    assert issues() == []
    client.post(f"/v1/venues/{kafe}/issues", json={"kind": "closed", "note": "Tabela yok"}, headers=auth(people[2]))
    [item] = issues()
    assert (item["venue_id"], item["kind"], item["reports"], item["notes"]) == (kafe, "closed", 3, ["Tabela yok"])
    assert client.get("/v1/admin/venue-issues", headers=auth(people[0])).status_code == 403
    # Dismissed: off the list; closed: off the map
    client.post(f"/v1/admin/venue-issues/{kafe}/closed", json={"action": "dismiss"}, headers=auth(admin))
    assert issues() == []
    for who in people:
        client.post(f"/v1/venues/{kafe}/issues", json={"kind": "closed"}, headers=auth(who))
    assert client.post(f"/v1/admin/venue-issues/{kafe}/closed", json={"action": "close"}, headers=auth(admin)).status_code == 204
    assert all(v["id"] != kafe for v in client.get("/v1/venues/search?q=Test Kafe").json())
