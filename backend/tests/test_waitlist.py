from tests.test_business import account, auth


def test_waitlist_sign_ups(client, conn):
    assert client.post("/v1/waitlist", json={"kind": "user", "contact": "ayse@example.test", "district": "Kadıköy"}).status_code == 204
    # The same e-mail again counts once; an Instagram name gets its @
    client.post("/v1/waitlist", json={"kind": "user", "contact": "AYSE@example.test"})
    client.post("/v1/waitlist", json={"kind": "user", "contact": "ayse.kahve"})
    assert client.post("/v1/waitlist", json={"kind": "user", "contact": "olmaz bu"}).status_code == 422
    # A business needs its venue's name
    assert client.post("/v1/waitlist", json={"kind": "business", "contact": "kafe@example.test"}).status_code == 422
    client.post("/v1/waitlist", json={"kind": "business", "contact": "kafe@example.test", "venue_name": "Moda Kafe"})
    admin = account(client, "t_yonetici")
    assert client.get("/v1/admin/waitlist", headers=auth(admin)).status_code == 403
    conn.execute("UPDATE users SET is_admin = true WHERE username = 't_yonetici'")
    rows = client.get("/v1/admin/waitlist", headers=auth(admin)).json()
    assert sorted((r["kind"], r["contact"]) for r in rows) == [
        ("business", "kafe@example.test"),
        ("user", "@ayse.kahve"),
        ("user", "ayse@example.test"),
    ]
