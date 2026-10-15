from datetime import datetime, timedelta, timezone
from statistics import mean
from zoneinfo import ZoneInfo

import pytest

from app.occupancy import DummyOccupancyProvider, Level, classify, daily_history, hourly_profile, weekday_averages

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
    first = provider.get(1, start)
    later = provider.get(1, start + timedelta(seconds=299))
    assert first == later


def test_value_changes_across_buckets():
    provider = DummyOccupancyProvider(bucket_seconds=300)
    start = datetime(2026, 10, 12, 13, 0, 0, tzinfo=timezone.utc)
    ratios = {provider.get(1, start + timedelta(minutes=5 * i)).ratio for i in range(6)}
    assert len(ratios) > 1


def test_values_within_bounds():
    provider = DummyOccupancyProvider()
    start = datetime(2026, 10, 12, 0, 0, 0, tzinfo=ISTANBUL)
    for venue_id in range(1, 21):
        for hour in range(24):
            occ = provider.get(venue_id, start + timedelta(hours=hour))
            assert 0.0 <= occ.ratio <= 1.0
            assert occ.level == classify(occ.ratio)


def test_peak_hours_busier_than_night():
    provider = DummyOccupancyProvider()
    day = datetime(2026, 10, 12, tzinfo=ISTANBUL)
    night = mean(provider.get(v, day.replace(hour=3)).ratio for v in range(1, 51))
    evening = mean(provider.get(v, day.replace(hour=19)).ratio for v in range(1, 51))
    assert evening > night + 0.4


def test_updated_at_is_bucket_start():
    provider = DummyOccupancyProvider(bucket_seconds=300)
    at = datetime(2026, 10, 12, 13, 7, 42, tzinfo=timezone.utc)
    assert provider.get(1, at).updated_at == datetime(2026, 10, 12, 13, 5, 0, tzinfo=timezone.utc)


def test_zero_popularity_is_always_empty():
    provider = DummyOccupancyProvider()
    evening = datetime(2026, 10, 12, 19, 0, tzinfo=ISTANBUL)
    for venue_id in range(1, 21):
        occ = provider.get(venue_id, evening, popularity=0.0)
        assert occ.ratio == 0.0
        assert occ.level == Level.LOW


def test_popularity_scales_down():
    provider = DummyOccupancyProvider()
    evening = datetime(2026, 10, 12, 19, 0, tzinfo=ISTANBUL)
    full = mean(provider.get(v, evening).ratio for v in range(1, 51))
    half = mean(provider.get(v, evening, popularity=0.5).ratio for v in range(1, 51))
    assert half < full



def test_hourly_profile_has_24_hours_with_evening_peak():
    provider = DummyOccupancyProvider()
    profile = hourly_profile(provider, 1, 1.0, datetime(2026, 10, 12).date())
    assert len(profile) == 24
    assert profile[19].ratio > profile[3].ratio


def test_hourly_profile_matches_provider_at_half_past():
    provider = DummyOccupancyProvider()
    profile = hourly_profile(provider, 7, 0.5, datetime(2026, 10, 12).date())
    assert profile[13] == provider.get(7, datetime(2026, 10, 12, 13, 30, tzinfo=ISTANBUL), 0.5)


def test_always_busy_venue_is_crowded_at_every_hour():
    provider = DummyOccupancyProvider()
    for venue_id in range(1, 11):
        for hour in range(24):
            at = datetime(2026, 10, 12, hour, 30, tzinfo=ISTANBUL)
            assert provider.get(venue_id, at, always_busy=True).level == Level.HIGH



def test_daily_history_and_weekday_averages():
    provider = DummyOccupancyProvider()
    last = datetime(2026, 10, 12).date()  # a Monday
    history = daily_history(provider, 3, 1.0, False, list(range(8, 23)), last, 14)
    assert [d for d, _ in history][-1] == last and len(history) == 14
    assert all(0 <= r <= 1 for _, r in history)
    averages = weekday_averages(history)
    assert len(averages) == 7
    monday = [r for d, r in history if d.weekday() == 0]
    assert averages[0] == round(sum(monday) / len(monday), 2)


# Same inputs and results as mobile/tests/forecast.test.ts: the backend and the
# serverless web demo must produce identical fake occupancy
PARITY_CASES = [
    (1, "2026-10-14T10:02:00+00:00", 1.0, False, 0.8),
    (7, "2026-10-14T05:40:00+00:00", 1.2, False, 0.48),
    (15, "2026-10-14T12:55:00+00:00", 0.9, False, 0.51),
    (28, "2026-10-16T07:30:00+00:00", 1.0, False, 0.47),
    (42, "2026-10-15T20:15:00+00:00", 0.8, False, 0.23),
    (3, "2026-10-14T01:00:00+00:00", 1.0, True, 0.83),
]


@pytest.mark.parametrize("venue_id,at,popularity,always_busy,expected", PARITY_CASES)
def test_matches_mobile_implementation(venue_id, at, popularity, always_busy, expected):
    provider = DummyOccupancyProvider(bucket_seconds=300, tz="Europe/Istanbul")
    got = provider.get(venue_id, datetime.fromisoformat(at), popularity, always_busy)
    assert got.ratio == expected
