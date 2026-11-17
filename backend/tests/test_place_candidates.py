from app.place_candidates import availo_category, import_csv
from tests.test_business import account, auth, business_at

# Test Kafe A is at 40.9840, 29.0260 (conftest)
CSV = """id|name|category|confidence|sources|operating_status|lat|lon
c1|Dondurma Evim|ice_cream_shop|0.9|['meta']||40.9850|29.0270
c2|Test Kafe A|cafe|0.95|['Foursquare']||40.98403|29.02602
c3|Belirsiz Yer|cafe|0.3|['meta']||40.9860|29.0280
c4|Kitap Kahve Kütüphane|library|0.8|['meta']||40.9870|29.0290
"""


def load(conn, tmp_path):
    # Start from none (the test's transaction is rolled back; the dev data stays)
    conn.execute("DELETE FROM place_candidates")
    path = tmp_path / "places.csv"
    path.write_text(CSV, encoding="utf-8")
    return import_csv(conn, str(path))


def test_categories_map_to_availo():
    assert availo_category("ice_cream_shop") == "cafe"
    assert availo_category("turkish_restaurant") == "restaurant"
    assert availo_category("cocktail_bar") == "bar"
    assert availo_category("coworking_space") == "coworking"


def test_import_hides_low_confidence_and_links_venues_already_on_the_map(client, conn, tmp_path):
    result = load(conn, tmp_path)
    assert result == {"imported": 3, "skipped": 1, "linked_to_venues": 1}
    # Already a venue: not offered as a new place
    assert client.get("/v1/places/candidates", params={"q": "test kafe"}).json() == []
    found = client.get("/v1/places/candidates", params={"q": "dondurma", "lat": 40.984, "lon": 29.026}).json()
    assert [f["name"] for f in found] == ["Dondurma Evim"] and found[0]["category"] == "cafe" and 100 < found[0]["distance_m"] < 200
    # Turkish letters typed plainly still find it
    assert client.get("/v1/places/candidates", params={"q": "kutuphane"}).json()[0]["id"] == "c4"


def test_adding_a_candidate_makes_one_venue(client, conn, tmp_path):
    load(conn, tmp_path)
    ali = account(client, "t_ali")
    guest = client.post("/v1/auth/guest").json()["token"]
    assert client.post("/v1/places/candidates/c1/venue", headers=auth(guest)).status_code == 403
    first = client.post("/v1/places/candidates/c1/venue", headers=auth(ali)).json()
    assert first["created"] is True
    venue = client.get("/v1/venues/search", params={"ids": str(first["id"])}).json()[0]
    assert venue["name"] == "Dondurma Evim" and venue["pending"] is False and venue["district"]
    # Asked again: the same venue, and it is no longer offered
    again = client.post("/v1/places/candidates/c1/venue", headers=auth(ali)).json()
    assert again == {"id": first["id"], "created": False}
    assert client.get("/v1/places/candidates", params={"q": "dondurma"}).json() == []
    token, _ = business_at(client, conn)
    assert client.post("/v1/places/candidates/c4/venue", headers=auth(token)).status_code == 403


def test_foursquare_adds_only_fresh_open_places_not_already_from_overture(client, conn, tmp_path):
    from datetime import date

    from app.place_candidates import fsq_category, import_fsq_csv

    load(conn, tmp_path)  # Overture: Dondurma Evim, Kitap Kahve Kütüphane
    fsq = tmp_path / "fsq.csv"
    fsq.write_text(
        "id|name|category|lat|lon|date_closed|date_refreshed|flags\n"
        "f1|Dondurma Evim|Dining and Drinking > Dessert Shop > Ice Cream Parlor|40.98502|29.02701||2026-05-01|\n"
        "f2|Yeni Kahveci|Dining and Drinking > Cafe, Coffee, and Tea House > Café|40.9880|29.0300||2026-06-01|\n"
        "f3|Eski Lokanta|Dining and Drinking > Restaurant|40.9890|29.0310||2019-01-01|\n"
        "f4|Kapanan Bar|Dining and Drinking > Bar|40.9900|29.0320|2025-01-01|2026-01-01|\n"
        "f5|Bir Şirket|Business and Professional Services > Office|40.9910|29.0330||2026-01-01|\n",
        encoding="utf-8",
    )
    result = import_fsq_csv(conn, str(fsq), today=date(2026, 11, 17))
    assert result["imported"] == 1 and result["same_as_overture"] == 1 and result["skipped"] == 3
    assert [c["name"] for c in client.get("/v1/places/candidates", params={"q": "kahveci"}).json()] == ["Yeni Kahveci"]
    assert fsq_category("Dining and Drinking > Restaurant > Turkish Restaurant") == "restaurant"
    assert fsq_category("Dining and Drinking > Bar > Cocktail Bar") == "bar"
