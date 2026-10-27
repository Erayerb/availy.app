def search(client, **params):
    response = client.get("/v1/venues/search", params=params)
    assert response.status_code == 200, response.text
    return {v["name"] for v in response.json()}


def test_search_without_query_returns_all(client):
    assert search(client) == {"Test Kafe A", "Test Cowork B", "Test Bar Uzak", "Test Kafe Ankara"}


def test_search_by_name_is_case_insensitive(client):
    assert search(client, q="kafe") == {"Test Kafe A", "Test Kafe Ankara"}
    assert search(client, q="  COWORK ") == {"Test Cowork B"}


def test_search_by_district(client):
    assert search(client, district="Çankaya") == {"Test Kafe Ankara"}


def test_search_combines_query_district_and_tags(client):
    assert search(client, q="test", district="Kadıköy", tags="quiet,entertainment") == {
        "Test Cowork B",
        "Test Bar Uzak",
    }


def test_search_rejects_unknown_tag(client):
    assert client.get("/v1/venues/search", params={"tags": "club"}).status_code == 422


def test_search_wildcards_are_literal(client):
    assert search(client, q="%") == set()


def test_districts(client):
    response = client.get("/v1/districts")
    assert response.status_code == 200
    assert response.json() == ["Çankaya", "Kadıköy"]  # Turkish order: Ç < K


def test_search_by_ids(client, conn):
    ids = {row["name"]: row["id"] for row in conn.execute("SELECT id, name FROM venues").fetchall()}
    wanted = f"{ids['Test Kafe A']},{ids['Test Kafe Ankara']}"
    assert search(client, ids=wanted) == {"Test Kafe A", "Test Kafe Ankara"}


def test_search_with_empty_ids_returns_nothing(client):
    assert search(client, ids="") == set()


def test_search_rejects_bad_ids(client):
    assert client.get("/v1/venues/search", params={"ids": "1,abc"}).status_code == 422


def test_search_ignores_turkish_letters(client):
    # Typed on an English keyboard
    assert search(client, q="kadikoy") == {"Test Kafe A", "Test Cowork B", "Test Bar Uzak"}
    assert search(client, q="CANKAYA") == {"Test Kafe Ankara"}
    assert search(client, q="Osmanaga") == {"Test Cowork B"}


def test_search_matches_neighborhood_and_district(client):
    assert search(client, q="kızılay") == {"Test Kafe Ankara"}
    assert search(client, q="Fikirtepe") == {"Test Bar Uzak"}
