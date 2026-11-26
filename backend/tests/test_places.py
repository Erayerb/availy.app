from app import places_api


def feature(name, lon, lat, **props):
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]}, "properties": {"name": name, **props}}


PHOTON = {
    "features": [
        feature("Teşvikiye", 28.99, 41.05, type="locality", osm_key="place", osm_value="neighbourhood", city="Şişli"),
        feature("Teşvikiye", 28.99, 41.05, type="house", osm_key="highway", osm_value="bus_stop", city="Şişli"),
        feature("Teşvikiye", 28.99, 41.05, type="house", osm_key="railway", osm_value="tram_stop", city="Şişli"),
        feature("Teşvikiye Caddesi", 28.99, 41.05, type="street", osm_key="highway", osm_value="secondary",
                locality="Taşkışla", district="Harbiye", city="Şişli"),
        # A long street comes in pieces: one row per name and area
        feature("Teşvikiye Caddesi", 28.99, 41.05, type="street", osm_key="highway", osm_value="secondary",
                locality="Taşkışla", district="Harbiye", city="Şişli"),
        feature("Teşvikiye Camii", 28.99, 41.05, type="house", osm_key="amenity", osm_value="place_of_worship",
                locality="Teşvikiye Mahallesi", city="İstanbul"),
        feature("Teşvikiye Sokağı", 29.7, 40.76, type="street", osm_key="highway", osm_value="residential",
                city="Körfez", state="Kocaeli"),
    ]
}


def test_suggestions_while_typing_skip_stops_and_are_kept_for_a_day(client, monkeypatch):
    places_api._cache.clear()
    places_api._calls.clear()
    asked = []
    monkeypatch.setattr(places_api, "fetch_photon", lambda params: asked.append(params) or PHOTON)
    found = client.get("/v1/places", params={"q": "teşvikiye"}).json()
    assert [(p["label"], p["detail"]) for p in found] == [
        ("Teşvikiye", "Şişli"),
        ("Teşvikiye Caddesi", "Taşkışla, Harbiye"),
        ("Teşvikiye Camii", "Teşvikiye"),  # " Mahallesi" dropped; "İstanbul" says nothing
    ]
    # Typed again (other case, extra spaces): from the cache, Photon is not asked twice
    assert client.get("/v1/places", params={"q": "  Teşvikiye "}).json() == found
    assert len(asked) == 1 and asked[0]["bbox"] == places_api.ISTANBUL_BBOX
    assert client.get("/v1/places", params={"q": "te"}).status_code == 422


def test_a_busy_photon_gives_no_suggestions_instead_of_an_error(client, monkeypatch):
    places_api._cache.clear()
    places_api._calls.clear()

    def busy(params):
        raise OSError("503")

    monkeypatch.setattr(places_api, "fetch_photon", busy)
    response = client.get("/v1/places", params={"q": "moda cad", "lat": 40.98, "lon": 29.03})
    assert response.status_code == 200 and response.json() == []


def test_one_address_cannot_use_it_as_a_free_proxy(client, monkeypatch):
    places_api._cache.clear()
    places_api._calls.clear()
    monkeypatch.setattr(places_api, "fetch_photon", lambda params: PHOTON)
    codes = [client.get("/v1/places", params={"q": f"sokak {i}"}).status_code for i in range(places_api.PER_IP_PER_MINUTE + 1)]
    assert codes[-1] == 429 and set(codes[:-1]) == {200}
