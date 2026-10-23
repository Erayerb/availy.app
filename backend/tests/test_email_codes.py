import re

import pytest

from app import mailer


@pytest.fixture(autouse=True)
def empty_outbox():
    mailer.outbox.clear()
    yield
    mailer.outbox.clear()


def register(client, username):
    body = {"email": f"{username}@example.test", "password": "gizli123", "username": username}
    return client.post("/v1/auth/register", json=body).json()


def last_code(to):
    mail = [m for m in mailer.outbox if m["to"] == [to]][-1]
    return re.search(r"\b(\d{6})\b", mail["text"]).group(1)


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_sign_up_sends_a_verification_code(client, conn):
    session = register(client, "t_ali")
    assert session["user"]["email_verified"] is False
    code = last_code("t_ali@example.test")
    wrong = "000000" if code != "000000" else "111111"
    assert client.post("/v1/me/email/verify", json={"code": wrong}, headers=auth(session["token"])).status_code == 400
    assert client.post("/v1/me/email/code", headers=auth(session["token"])).status_code == 429  # within a minute
    verified = client.post("/v1/me/email/verify", json={"code": code}, headers=auth(session["token"]))
    assert verified.status_code == 200 and verified.json()["email_verified"] is True
    assert client.get("/v1/me", headers=auth(session["token"])).json()["email_verified"] is True
    assert client.post("/v1/me/email/code", headers=auth(session["token"])).status_code == 409


def test_forgot_password(client, conn):
    old = register(client, "t_ali")["token"]
    # Unknown e-mail: the same answer, nothing sent
    assert client.post("/v1/auth/forgot", json={"email": "kimse@example.test"}).status_code == 204
    assert client.post("/v1/auth/forgot", json={"email": " T_Ali@example.test "}).status_code == 204
    code = last_code("t_ali@example.test")
    assert "sıfırla" in mailer.outbox[-1]["subject"]
    body = {"email": "t_ali@example.test", "code": code, "password": "yenisifre"}
    assert client.post("/v1/auth/reset", json={**body, "password": "123"}).status_code == 400
    assert client.post("/v1/auth/reset", json=body).status_code == 204
    assert client.post("/v1/auth/reset", json=body).status_code == 400  # a code works once
    assert client.get("/v1/me", headers=auth(old)).status_code == 401  # old sessions signed out
    login = client.post("/v1/auth/login", json={"login": "t_ali", "password": "yenisifre"})
    assert login.status_code == 200 and login.json()["user"]["email_verified"] is True


def test_reset_code_stops_after_five_wrong_tries(client, conn):
    register(client, "t_ali")
    client.post("/v1/auth/forgot", json={"email": "t_ali@example.test"})
    code = last_code("t_ali@example.test")
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        client.post("/v1/auth/reset", json={"email": "t_ali@example.test", "code": wrong, "password": "yenisifre"})
    right = client.post("/v1/auth/reset", json={"email": "t_ali@example.test", "code": code, "password": "yenisifre"})
    assert right.status_code == 400
