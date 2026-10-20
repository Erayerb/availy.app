from datetime import datetime, timedelta, timezone

import pytest

from app.accounts import (
    SESSION_DAYS,
    create_session,
    hash_password,
    user_for_token,
    validate_registration,
    verify_password,
)

EMAIL = "test.kullanici@example.test"
PASSWORD = "gizli123"


def register(client, email=EMAIL, password=PASSWORD, role="personal", name="Test Kullanıcı"):
    return client.post("/v1/auth/register", json={"name": name, "email": email, "password": password, "role": role})


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_password_hash_round_trip():
    stored = hash_password(PASSWORD)
    assert stored.startswith("scrypt$") and PASSWORD not in stored
    assert verify_password(PASSWORD, stored)
    assert not verify_password("yanlis123", stored)
    # A new random salt each time
    assert hash_password(PASSWORD) != stored
    assert not verify_password(PASSWORD, "bozuk-kayit")


@pytest.mark.parametrize(
    "name,email,password,role,message",
    [
        ("A", EMAIL, PASSWORD, "personal", "Adını gir."),
        ("Ayşe", "eposta-degil", PASSWORD, "personal", "Geçerli bir e-posta gir."),
        ("Ayşe", EMAIL, "123", "personal", "Şifre en az 6 karakter olmalı."),
        ("Ayşe", EMAIL, PASSWORD, "admin", "Hesap türü bireysel ya da işletme olmalı."),
    ],
)
def test_registration_rules(name, email, password, role, message):
    assert validate_registration(name, email, password, role) == message


def test_register_returns_session_and_normalized_email(client):
    response = register(client, email="  Test.Kullanici@Example.TEST ")
    assert response.status_code == 201
    body = response.json()
    assert body["token"]
    assert body["user"]["email"] == EMAIL
    assert body["user"]["role"] == "personal"
    assert "password" not in str(body).lower()


def test_register_twice_is_rejected(client):
    register(client)
    response = register(client, email=EMAIL.upper())
    assert response.status_code == 409
    assert response.json()["detail"] == "Bu e-posta zaten kayıtlı. Giriş yapmayı dene."


def test_register_validation_error_in_turkish(client):
    response = register(client, password="123")
    assert response.status_code == 400
    assert response.json()["detail"] == "Şifre en az 6 karakter olmalı."


def test_login_and_me(client):
    register(client, role="business")
    response = client.post("/v1/auth/login", json={"email": EMAIL, "password": PASSWORD, "role": "business"})
    assert response.status_code == 200
    token = response.json()["token"]
    me = client.get("/v1/me", headers=auth(token)).json()
    assert me["email"] == EMAIL and me["role"] == "business" and me["venue_id"] is None


def test_wrong_password_and_unknown_email_get_the_same_message(client):
    register(client)
    wrong = client.post("/v1/auth/login", json={"email": EMAIL, "password": "yanlis123"})
    unknown = client.post("/v1/auth/login", json={"email": "yok@example.test", "password": PASSWORD})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"] == "E-posta ya da şifre hatalı."


def test_login_with_the_other_account_type(client):
    register(client, role="personal")
    response = client.post("/v1/auth/login", json={"email": EMAIL, "password": PASSWORD, "role": "business"})
    assert response.status_code == 403
    assert "bireysel" in response.json()["detail"]


def test_me_needs_a_valid_token(client):
    assert client.get("/v1/me").status_code == 401
    assert client.get("/v1/me", headers=auth("uydurma")).status_code == 401
    token = register(client).json()["token"]
    assert client.get("/v1/me", headers={"Authorization": f"Basic {token}"}).status_code == 401


def test_logout_ends_the_session(client):
    token = register(client).json()["token"]
    assert client.post("/v1/auth/logout", headers=auth(token)).status_code == 204
    assert client.get("/v1/me", headers=auth(token)).status_code == 401


def test_sessions_expire(client, conn):
    user_id = register(client).json()["user"]["id"]
    past = datetime.now(timezone.utc) - timedelta(days=SESSION_DAYS + 1)
    token = create_session(conn, user_id, now=past)
    assert user_for_token(conn, token) is None
    assert client.get("/v1/me", headers=auth(token)).status_code == 401


def test_only_the_token_hash_is_stored(client, conn):
    token = register(client).json()["token"]
    stored = [r["token_hash"] for r in conn.execute("SELECT token_hash FROM sessions").fetchall()]
    assert token not in stored and len(stored) >= 1


def test_guest_gets_an_automatic_id_and_session(client):
    first = client.post("/v1/auth/guest")
    second = client.post("/v1/auth/guest")
    assert first.status_code == second.status_code == 201
    a, b = first.json()["user"], second.json()["user"]
    assert a["is_guest"] and a["email"] is None
    assert a["id"] != b["id"]
    assert a["name"] == f"Misafir {a['id']}"
    me = client.get("/v1/me", headers=auth(first.json()["token"])).json()
    assert me["id"] == a["id"] and me["is_guest"]


def test_guest_session_lasts_a_year(client, conn):
    token = client.post("/v1/auth/guest").json()["token"]
    row = conn.execute("SELECT expires_at - created_at AS length FROM sessions ORDER BY created_at DESC LIMIT 1").fetchone()
    assert row["length"].days == 365
    assert token


def test_guest_counts_less_until_sign_up(client, conn):
    guest = client.post("/v1/auth/guest").json()
    trust = conn.execute("SELECT trust FROM users WHERE id = %s", (guest["user"]["id"],)).fetchone()["trust"]
    assert trust == 0.5


def test_guest_upgrade_keeps_the_id(client, conn):
    guest = client.post("/v1/auth/guest").json()
    token = guest["token"]
    body = {"name": "Ayşe", "email": EMAIL, "password": PASSWORD, "role": "personal"}
    response = client.post("/v1/auth/upgrade", json=body, headers=auth(token))
    assert response.status_code == 200
    user = response.json()
    assert user["id"] == guest["user"]["id"] and not user["is_guest"] and user["email"] == EMAIL
    assert conn.execute("SELECT trust FROM users WHERE id = %s", (user["id"],)).fetchone()["trust"] == 1
    # Same session still works, and the new password signs in to the same account
    assert client.get("/v1/me", headers=auth(token)).json()["id"] == user["id"]
    login = client.post("/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}).json()
    assert login["user"]["id"] == user["id"]
    # Only once
    assert client.post("/v1/auth/upgrade", json=body, headers=auth(token)).status_code == 409


def test_guest_upgrade_with_a_taken_email(client):
    register(client)
    token = client.post("/v1/auth/guest").json()["token"]
    body = {"name": "Ayşe", "email": EMAIL, "password": PASSWORD}
    response = client.post("/v1/auth/upgrade", json=body, headers=auth(token))
    assert response.status_code == 409


def test_guests_cannot_sign_in_with_a_password(client):
    client.post("/v1/auth/guest")
    response = client.post("/v1/auth/login", json={"email": "", "password": PASSWORD})
    assert response.status_code == 401
