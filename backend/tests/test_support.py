from tests.test_business import account, auth

BUG = {"kind": "bug", "topic": "Uygulama hatası", "body": "Harita açılınca donuyor.", "app_info": "ios 1.0"}


def test_bug_reports_and_contact_messages(client, conn):
    assert client.post("/v1/support", json=BUG).status_code == 201  # without an account too
    ali = account(client, "t_ali")
    assert client.post("/v1/support", json={**BUG, "body": "kısa"}, headers=auth(ali)).status_code == 400
    assert client.post("/v1/support", json={**BUG, "topic": "Uydurma"}, headers=auth(ali)).status_code == 400
    contact = {"kind": "contact", "topic": "Genel", "body": "İşletmem için bilgi almak istiyorum."}
    assert client.post("/v1/support", json=contact, headers=auth(ali)).status_code == 400  # needs an e-mail
    assert client.post("/v1/support", json={**contact, "email": "t_ali@example.test"}, headers=auth(ali)).status_code == 201
    row = conn.execute(
        "SELECT s.kind, u.username FROM support_messages s JOIN users u ON u.id = s.user_id ORDER BY s.id DESC LIMIT 1"
    ).fetchone()
    assert (row["kind"], row["username"]) == ("contact", "t_ali")
    for _ in range(9):
        client.post("/v1/support", json=BUG, headers=auth(ali))
    assert client.post("/v1/support", json=BUG, headers=auth(ali)).status_code == 429
