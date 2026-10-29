from app.import_contacts import best_match, name_score, turkish_phone


def test_names_match_without_the_type_words():
    assert name_score("Moda Kahve Evi", "MODA KAHVE EVİ") == 1.0
    assert name_score("Kronotrop Caddebostan", "Kronotrop Coffee Caddebostan") >= 0.72
    assert name_score("Mado", "Mavi Bar") < 0.72
    # A shared neighbourhood name is not enough
    assert name_score("Kronotrop Caddebostan", "Nou Caddebostan") < 0.72
    assert name_score("MOC Teşvikiye", "Cafein Teşvikiye") < 0.72


def test_phones_become_turkish_numbers():
    assert turkish_phone("0216 555 12 34") == "+90 216 555 12 34"
    assert turkish_phone("+905334787816") == "+90 533 478 78 16"
    assert turkish_phone("+15334787816") == "+90 533 478 78 16"  # a wrong country code on a Turkish mobile
    assert turkish_phone("+44 20 7946 0958") is None


def test_the_nearest_place_with_the_same_name():
    venue = {"name": "Moda Kahve Evi", "lat": 40.9850, "lon": 29.0270}
    near = {"name": "Moda Kahve Evi", "lat": 40.9853, "lon": 29.0272}  # ~35 m
    far = {"name": "Moda Kahve Evi", "lat": 40.9900, "lon": 29.0270}  # ~550 m
    other = {"name": "Başka Yer", "lat": 40.9850, "lon": 29.0270}
    assert best_match(venue, [far, other, near]) is near
    assert best_match(venue, [far, other]) is None
