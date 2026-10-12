import random
from dataclasses import dataclass
from datetime import datetime, timezone
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
    people: int
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


class OccupancyProvider(Protocol):
    def get(self, venue_id: int, capacity: int, at: datetime) -> Occupancy: ...


# Typical busyness by local hour (0-23): quiet nights, lunch and evening peaks
HOURLY_BASE = [
    0.05, 0.05, 0.05, 0.05, 0.05, 0.05,  # 00-05
    0.10, 0.20, 0.30, 0.35, 0.40, 0.50,  # 06-11
    0.75, 0.80, 0.60, 0.50, 0.50, 0.60,  # 12-17
    0.75, 0.85, 0.80, 0.60, 0.40, 0.20,  # 18-23
]
NOISE = 0.20


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

    def get(self, venue_id: int, capacity: int, at: datetime) -> Occupancy:
        bucket = int(at.timestamp()) // self.bucket_seconds
        rng = random.Random(f"{venue_id}:{bucket}")

        local_hour = at.astimezone(self.tz).hour
        ratio = HOURLY_BASE[local_hour] + rng.uniform(-NOISE, NOISE)
        ratio = round(min(max(ratio, 0.0), 1.0), 2)

        return Occupancy(
            level=classify(ratio),
            ratio=ratio,
            people=round(ratio * capacity),
            updated_at=datetime.fromtimestamp(bucket * self.bucket_seconds, tz=timezone.utc),
        )


def get_occupancy_provider() -> OccupancyProvider:
    """FastAPI dependency; swap here when a real data source exists."""
    return DummyOccupancyProvider()
