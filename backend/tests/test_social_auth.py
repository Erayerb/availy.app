import pytest

from app import social_auth
from app.config import settings
from app.social_auth import Identity
from tests.test_business import account, auth


@pytest.fixture
def tokens(monkeypatch):
    """The provider's check stubbed: the token text is "sub|email|verified"."""
    monkeypatch.setattr(settings, "google_client_ids", ["test-client"])
    monkeypatch.setattr(settings, "apple_audiences", ["app.availo.test"])

    def fake(provider, token):
        sub, email, verified = token.split("|")[:3]
        return Identity(provider, sub, email or None, verified == "1")

    monkeypatch.setattr(social_auth, "verify_id_token", fake)


def sign_in(client, token, provider="google", **extra):
    return client.post("/v1/auth/oauth", json={"provider": provider, "id_token": token + "|" + "x" * 20, **extra})


def test_buttons_only_for_providers_set_up(client, monkeypatch):
    assert client.get("/v1/auth/providers").json() == {"providers": []}
    monkeypatch.setattr(settings, "google_client_ids", ["x"])
    assert client.get("/v1/auth/providers").json() == {"providers": ["google"]}
    # Not set up: the server refuses rather than trusting the token
    r = client.post("/v1/auth/oauth", json={"provider": "apple", "id_token": "x" * 40})
    assert r.status_code == 503


def test_a_bad_token_is_refused(client, monkeypatch):
    monkeypatch.setattr(settings, "google_client_ids", ["x"])
    r = client.post("/v1/auth/oauth", json={"provider": "google", "id_token": "not-a-real-jwt-token-at-all"})
    assert r.status_code == 401


def test_first_sign_in_makes_an_account_then_signs_in(client, conn, tokens):
    first = sign_in(client, "g-1|ayse.kaya@gmail.com|1")
    assert first.status_code == 200 and first.json()["created"] is True
    user = first.json()["user"]
    assert user["username"] == "ayse.kaya" and user["email_verified"] is True
    me = client.get("/v1/me", headers=auth(first.json()["token"]))
    assert me.status_code == 200
    again = sign_in(client, "g-1|ayse.kaya@gmail.com|1")
    assert again.json()["created"] is False and again.json()["user"]["id"] == user["id"]
    # No password: e-mail + password sign-in does not open it
    r = client.post("/v1/auth/login", json={"login": "ayse.kaya", "password": "herhangi-bir-sifre"})
    assert r.status_code in (400, 401)
    # The user name is taken by someone else next time: a number is added
    other = sign_in(client, "g-2|ayse.kaya@hotmail.com|1", provider="google")
    assert other.json()["user"]["username"].startswith("ayse.kaya") and other.json()["user"]["username"] != "ayse.kaya"


def test_a_verified_email_links_to_the_existing_account(client, conn, tokens):
    account(client, "t_ali")
    email = conn.execute("SELECT email FROM users WHERE username = 't_ali'").fetchone()["email"]
    unverified = sign_in(client, f"a-1|{email}|0", provider="apple")
    assert unverified.status_code == 409
    linked = sign_in(client, f"a-1|{email}|1", provider="apple")
    assert linked.status_code == 200 and linked.json()["created"] is False
    assert linked.json()["user"]["username"] == "t_ali"
    # Apple may hide the e-mail on later sign-ins: the saved link is enough
    assert sign_in(client, "a-1||0", provider="apple").json()["user"]["username"] == "t_ali"
