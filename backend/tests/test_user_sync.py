from datetime import timedelta

from tests.test_business import account, auth
from tests.test_checkins import clock, venue_id  # noqa: F401 (clock is a fixture)


def test_favorites_watches_and_settings_follow_the_account(client, conn, clock):
    ali = account(client, "t_ali")
    kafe, bar = venue_id(conn, "Test Kafe A"), venue_id(conn, "Test Bar Uzak")
    # Favorites: added twice counts once, removed, unknown venue refused
    for v in (kafe, bar, kafe):
        assert client.put(f"/v1/me/favorites/{v}", headers=auth(ali)).status_code == 204
    assert client.get("/v1/me/favorites", headers=auth(ali)).json() == [kafe, bar]
    client.delete(f"/v1/me/favorites/{kafe}", headers=auth(ali))
    assert client.get("/v1/me/favorites", headers=auth(ali)).json() == [bar]
    assert client.put("/v1/me/favorites/999999", headers=auth(ali)).status_code == 404
    # Watches: an older phone watch keeps its time; after 6 hours it is gone
    old = (clock.now - timedelta(hours=7)).isoformat()
    client.put(f"/v1/me/watches/{kafe}", json={}, headers=auth(ali))
    client.put(f"/v1/me/watches/{bar}", json={"created_at": old}, headers=auth(ali))
    assert [w["venue_id"] for w in client.get("/v1/me/watches", headers=auth(ali)).json()] == [kafe]
    # Settings: null until saved, then the same on every phone
    assert client.get("/v1/me/settings", headers=auth(ali)).json() is None
    client.put("/v1/me/settings", json={"appearance": "dark", "colorBlind": True}, headers=auth(ali))
    assert client.get("/v1/me/settings", headers=auth(ali)).json() == {"appearance": "dark", "colorBlind": True}
    # Someone else sees none of it
    other = account(client, "t_ayse")
    assert client.get("/v1/me/favorites", headers=auth(other)).json() == []
    assert client.get("/v1/me/watches", headers=auth(other)).json() == []
