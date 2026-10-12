from app.hours import hours_for


def test_cafe_hours():
    cafe = hours_for("cafe")
    assert cafe.label() == "08:00–23:00"
    assert cafe.is_open_at_hour(8) and cafe.is_open_at_hour(22)
    assert not cafe.is_open_at_hour(7) and not cafe.is_open_at_hour(23)


def test_bar_closes_after_midnight():
    bar = hours_for("bar")
    assert bar.label() == "17:00–03:00"
    assert bar.is_open_at_hour(23) and bar.is_open_at_hour(2)
    assert not bar.is_open_at_hour(3) and not bar.is_open_at_hour(12)


def test_restaurant_closes_at_midnight():
    restaurant = hours_for("restaurant")
    assert restaurant.label() == "11:00–00:00"
    assert restaurant.is_open_at_hour(23) and not restaurant.is_open_at_hour(0)


def test_always_busy_test_venues_never_close():
    venue = hours_for("cafe", always_busy=True)
    assert venue.label() == "24 saat açık"
    assert all(venue.is_open_at_hour(h) for h in range(24))
