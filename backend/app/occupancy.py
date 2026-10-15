import math
from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from enum import StrEnum
from typing import Protocol
from zoneinfo import ZoneInfo

from app.config import settings


class Level(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass(frozen=True)
class Occupancy:
    level: Level
    ratio: float
    updated_at: datetime


def classify(
    ratio: float,
    low_max: float = settings.occupancy_low_max,
    medium_max: float = settings.occupancy_medium_max,
) -> Level:
    if ratio < low_max:
        return Level.LOW
    if ratio <= medium_max:
        return Level.MEDIUM
    return Level.HIGH


@dataclass(frozen=True)
class AreaOccupancy:
    level: Level
    ratio: float


def average_occupancy(ratios: list[float]) -> AreaOccupancy:
    """Mean occupancy of an area (e.g. all venues in a district)."""
    if not ratios:
        raise ValueError("ratios must not be empty")
    ratio = round(sum(ratios) / len(ratios), 2)
    return AreaOccupancy(level=classify(ratio), ratio=ratio)


class OccupancyProvider(Protocol):
    def get(
        self, venue_id: int, at: datetime, popularity: float = 1.0, always_busy: bool = False
    ) -> Occupancy: ...


# Typical busyness by local hour (0-23): quiet nights, lunch and evening peaks
HOURLY_BASE = [
    0.05, 0.05, 0.05, 0.05, 0.05, 0.05,  # 00-05
    0.10, 0.20, 0.30, 0.35, 0.40, 0.50,  # 06-11
    0.75, 0.80, 0.60, 0.50, 0.50, 0.60,  # 12-17
    0.75, 0.85, 0.80, 0.60, 0.40, 0.20,  # 18-23
]
NOISE = 0.20
# Test venues that are crowded at every hour stay between 0.80 and 0.96
ALWAYS_BUSY_BASE = 0.88
ALWAYS_BUSY_NOISE = 0.08


def _imul(a: int, b: int) -> int:
    """32-bit multiply like JavaScript's Math.imul (as an unsigned value)."""
    return (a * b) & 0xFFFFFFFF


def seeded_random(seed: str) -> float:
    """Deterministic number in [0, 1) for a string seed (FNV-1a + mulberry32 step).

    Same algorithm as mobile/src/lib/dummyOccupancy.ts, so the backend and the
    serverless web demo show the same fake occupancy.
    """
    h = 2166136261
    for ch in seed:
        h = _imul(h ^ ord(ch), 16777619)
    t = (h + 0x6D2B79F5) & 0xFFFFFFFF
    t = _imul(t ^ (t >> 15), t | 1)
    t ^= (t + _imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF
    return (t ^ (t >> 14)) / 4294967296


def round_ratio(ratio: float) -> float:
    """Two decimals, rounding halves up like JavaScript's Math.round."""
    return math.floor(ratio * 100 + 0.5) / 100


class DummyOccupancyProvider:
    """Fake occupancy for the MVP: no real data source is used.

    Deterministic per (venue, time bucket), so repeated polls inside the same
    bucket return the same value and the map changes only between buckets.
    """

    def __init__(
        self,
        bucket_seconds: int = settings.dummy_bucket_seconds,
        tz: str = settings.dummy_timezone,
    ):
        self.bucket_seconds = bucket_seconds
        self.tz = ZoneInfo(tz)

    def get(
        self, venue_id: int, at: datetime, popularity: float = 1.0, always_busy: bool = False
    ) -> Occupancy:
        bucket = int(at.timestamp()) // self.bucket_seconds
        noise = seeded_random(f"{venue_id}:{bucket}") * 2 - 1

        local_hour = at.astimezone(self.tz).hour
        if always_busy:
            ratio = ALWAYS_BUSY_BASE + noise * ALWAYS_BUSY_NOISE
        else:
            ratio = (HOURLY_BASE[local_hour] + noise * NOISE) * popularity
        ratio = round_ratio(min(max(ratio, 0.0), 1.0))

        return Occupancy(
            level=classify(ratio),
            ratio=ratio,
            updated_at=datetime.fromtimestamp(bucket * self.bucket_seconds, tz=timezone.utc),
        )


def get_occupancy_provider() -> OccupancyProvider:
    """FastAPI dependency; swap here when a real data source exists."""
    return DummyOccupancyProvider()


def hourly_profile(
    provider: OccupancyProvider,
    venue_id: int,
    popularity: float,
    day: date,
    always_busy: bool = False,
    tz: str = settings.dummy_timezone,
) -> list[Occupancy]:
    """Occupancy at half past each local hour of `day` (used by the business stats panel)."""
    zone = ZoneInfo(tz)
    return [
        provider.get(venue_id, datetime.combine(day, time(hour, 30), tzinfo=zone), popularity, always_busy)
        for hour in range(24)
    ]


def daily_history(
    provider: OccupancyProvider,
    venue_id: int,
    popularity: float,
    always_busy: bool,
    open_hours: list[int],
    last_day: date,
    days: int,
) -> list[tuple[date, float]]:
    """Average occupancy during opening hours for each of the `days` days ending at `last_day`."""
    from datetime import timedelta

    result = []
    for offset in range(days - 1, -1, -1):
        day = last_day - timedelta(days=offset)
        profile = hourly_profile(provider, venue_id, popularity, day, always_busy=always_busy)
        ratios = [profile[h].ratio for h in open_hours] or [0.0]
        result.append((day, round(sum(ratios) / len(ratios), 2)))
    return result


def weekday_averages(history: list[tuple[date, float]]) -> list[float]:
    """Mean of the daily averages per weekday, Monday first."""
    buckets: list[list[float]] = [[] for _ in range(7)]
    for day, ratio in history:
        buckets[day.weekday()].append(ratio)
    return [round(sum(b) / len(b), 2) if b else 0.0 for b in buckets]
