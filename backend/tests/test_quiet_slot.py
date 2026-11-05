from datetime import datetime, timedelta, timezone

from app.business import quietest_slot

ISTANBUL_MONDAY_NOON = datetime(2026, 11, 2, 9, 0, tzinfo=timezone.utc)  # 12:00 in Istanbul


def busy_except(day: int, start: int, open_hour: int = 8, close_hour: int = 22) -> list[datetime]:
    """One check-in in every open hour of the week but the two hours from `start` on `day`."""
    monday = ISTANBUL_MONDAY_NOON - timedelta(hours=12)
    return [
        monday + timedelta(days=d, hours=h)
        for d in range(7)
        for h in range(open_hour, close_hour)
        if not (d == day and start <= h < start + 2)
    ]


def test_the_emptiest_two_hours_of_the_week():
    assert quietest_slot(busy_except(1, 14), 8, 22) == {"weekday": 1, "start_hour": 14, "hours": 2, "checkins": 0}


def test_too_few_check_ins_say_nothing():
    assert quietest_slot([ISTANBUL_MONDAY_NOON] * 29, 8, 22) is None


def test_only_while_open():
    # Open 20:00-02:00: never suggests the morning, though nobody comes then
    slot = quietest_slot(busy_except(2, 21, 20, 24) * 2, 20, 2)
    assert slot["start_hour"] in (20, 21, 22, 23, 0)
