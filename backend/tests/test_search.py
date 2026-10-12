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


def test_search_includes_occupancy(client):
    venue = client.get("/v1/venues/search", params={"q": "Kafe A"}).json()[0]
    assert venue["occupancy"]["ratio"] == 0.2
    assert venue["district_occupancy"] == {"level": "medium", "ratio": 0.53}


def test_search_rejects_unknown_tag(client):
    assert client.get("/v1/venues/search", params={"tags": "club"}).status_code == 422


def test_search_wildcards_are_literal(client):
    assert search(client, q="%") == set()


def test_districts(client):
    response = client.get("/v1/districts")
    assert response.status_code == 200
    assert response.json() == ["Çankaya", "Kadıköy"]  # Turkish order: Ç < K
