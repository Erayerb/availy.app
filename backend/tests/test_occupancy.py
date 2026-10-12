from datetime import datetime, timedelta, timezone
from statistics import mean
from zoneinfo import ZoneInfo

import pytest

from app.occupancy import DummyOccupancyProvider, Level, classify

ISTANBUL = ZoneInfo("Europe/Istanbul")


@pytest.mark.parametrize(
    ("ratio", "expected"),
    [
        (0.0, Level.LOW),
        (0.39, Level.LOW),
        (0.40, Level.MEDIUM),
        (0.75, Level.MEDIUM),
        (0.76, Level.HIGH),
        (1.0, Level.HIGH),
    ],
)
def test_classify_thresholds(ratio, expected):
    assert classify(ratio) == expected


def test_same_bucket_gives_same_value():
    provider = DummyOccupancyProvider(bucket_seconds=300)
    start = datetime(2026, 10, 12, 13, 0, 0, tzinfo=timezone.utc)
    first = provider.get(1, 40, start)
    later = provider.get(1, 40, start + timedelta(seconds=299))
    assert first == later


def test_value_changes_across_buckets():
    provider = DummyOccupancyProvider(bucket_seconds=300)
    start = datetime(2026, 10, 12, 13, 0, 0, tzinfo=timezone.utc)
    ratios = {provider.get(1, 40, start + timedelta(minutes=5 * i)).ratio for i in range(6)}
    assert len(ratios) > 1


def test_values_within_bounds():
    provider = DummyOccupancyProvider()
    start = datetime(2026, 10, 12, 0, 0, 0, tzinfo=ISTANBUL)
    for venue_id in range(1, 21):
        for hour in range(24):
            occ = provider.get(venue_id, 30, start + timedelta(hours=hour))
            assert 0.0 <= occ.ratio <= 1.0
            assert 0 <= occ.people <= 30
            assert occ.level == classify(occ.ratio)


def test_peak_hours_busier_than_night():
    provider = DummyOccupancyProvider()
    day = datetime(2026, 10, 12, tzinfo=ISTANBUL)
    night = mean(provider.get(v, 50, day.replace(hour=3)).ratio for v in range(1, 51))
    evening = mean(provider.get(v, 50, day.replace(hour=19)).ratio for v in range(1, 51))
    assert evening > night + 0.4


def test_updated_at_is_bucket_start():
    provider = DummyOccupancyProvider(bucket_seconds=300)
    at = datetime(2026, 10, 12, 13, 7, 42, tzinfo=timezone.utc)
    assert provider.get(1, 40, at).updated_at == datetime(2026, 10, 12, 13, 5, 0, tzinfo=timezone.utc)
