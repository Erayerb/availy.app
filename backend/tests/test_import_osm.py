from app.import_osm import PILOT_AREAS, upsert, venue_from_element

NISANTASI = PILOT_AREAS[0]


def element(**tags):
    return {"type": "node", "id": 42, "lat": 41.05, "lon": 28.99, "tags": tags}


def test_cafe_with_hours_and_wifi():
    venue = venue_from_element(
        element(amenity="cafe", name="Kahve Durağı", opening_hours="Mo-Su 08:00-23:30", internet_access="wlan"),
        NISANTASI,
    )
    assert venue["osm_id"] == "node/42" and venue["category"] == "cafe"
    assert venue["tags"] == ["coworking", "socializing"]
    assert (venue["open_hour"], venue["close_hour"]) == (8, 24)
    assert (venue["neighborhood"], venue["district"]) == ("Nişantaşı", "Şişli")


def test_ways_use_their_center_and_pubs_are_bars():
    way = {"type": "way", "id": 7, "center": {"lat": 41.05, "lon": 28.99}, "tags": {"amenity": "pub", "name": "Pub"}}
    venue = venue_from_element(way, NISANTASI)
    assert venue["osm_id"] == "way/7" and venue["category"] == "bar" and "nightlife" in venue["tags"]
    assert venue["open_hour"] is None  # no hours: category default


def test_unnamed_or_other_places_are_skipped():
    assert venue_from_element(element(amenity="cafe"), NISANTASI) is None
    assert venue_from_element(element(amenity="fast_food", name="Döner"), NISANTASI) is None


def test_parks_and_beaches_are_nature():
    park = venue_from_element(element(leisure="park", name="Maçka Parkı"), NISANTASI)
    beach = venue_from_element(element(natural="beach", name="Caddebostan Plajı"), NISANTASI)
    assert park["category"] == beach["category"] == "park"
    assert "nature" in park["tags"] and "nature" in beach["tags"]
    assert venue_from_element(element(amenity="nightclub", name="Kulüp"), NISANTASI)["tags"] == ["entertainment", "nightlife"]


def test_coworking_and_address_suburb():
    venue = venue_from_element(element(office="coworking", name="Ofis", **{"addr:suburb": "Teşvikiye"}), NISANTASI)
    assert venue["category"] == "coworking" and venue["neighborhood"] == "Teşvikiye"


def test_reimport_updates_instead_of_duplicating(conn):
    venue = venue_from_element(element(amenity="cafe", name="Kahve Durağı"), NISANTASI)
    assert upsert(conn, venue) is True
    assert upsert(conn, {**venue, "name": "Kahve Durağı Nişantaşı"}) is False
    rows = conn.execute("SELECT name, source FROM venues WHERE osm_id = 'node/42'").fetchall()
    assert rows == [{"name": "Kahve Durağı Nişantaşı", "source": "osm"}]
