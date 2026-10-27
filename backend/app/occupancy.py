"""Crowd levels (Sakin / Orta / Kalabalık) and how a 0–1 score maps onto them.

v1 also generated fake occupancy here; v2 takes it from check-ins (app/crowd.py).
"""
from enum import StrEnum

from app.config import settings


class Level(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


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
