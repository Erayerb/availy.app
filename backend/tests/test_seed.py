from app.seed import DEMO_VENUES, seed


def test_seed_adds_demo_venues_and_keeps_existing(conn):
    # conn fixture already holds 4 test venues; seed must not remove them
    added = seed(conn)
    assert added == len(DEMO_VENUES)
    total = conn.execute("SELECT count(*) AS n FROM venues").fetchone()["n"]
    assert total == len(DEMO_VENUES) + 4


def test_seed_is_idempotent(conn):
    seed(conn)
    assert seed(conn) == 0


def test_demo_data_has_empty_venues():
    assert sum(1 for v in DEMO_VENUES if v[-1] == 0) >= 2
    assert len({v[0] for v in DEMO_VENUES}) == len(DEMO_VENUES)  # unique names


def test_demo_data_has_no_night_clubs():
    assert all(v[1] != "club" for v in DEMO_VENUES)


def test_demo_data_has_restaurants_with_food_tag():
    restaurants = [v for v in DEMO_VENUES if v[1] == "restaurant"]
    assert len(restaurants) >= 5
    assert all("food" in v[7] for v in restaurants)
