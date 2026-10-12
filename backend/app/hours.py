"""Opening hours (demo): by venue category, in Istanbul local time.

A closing hour <= opening hour means the venue closes after midnight
(e.g. a bar open 17:00-03:00).
"""
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import settings

HOURS_BY_CATEGORY: dict[str, tuple[int, int]] = {
    "cafe": (8, 23),
    "bar": (17, 3),
    "restaurant": (11, 24),
    "coworking": (8, 22),
    "library": (9, 21),
}
DEFAULT_HOURS = (9, 22)
ALL_DAY = (0, 24)


@dataclass(frozen=True)
class OpeningHours:
    open_hour: int
    close_hour: int

    @property
    def all_day(self) -> bool:
        return (self.open_hour, self.close_hour) == ALL_DAY

    def is_open_at_hour(self, hour: int) -> bool:
        if self.all_day:
            return True
        close = self.close_hour % 24
        if self.open_hour < close:
            return self.open_hour <= hour < close
        # Past midnight (or closing at 24:00)
        return hour >= self.open_hour or hour < close

    def label(self) -> str:
        if self.all_day:
            return "24 saat açık"
        return f"{self.open_hour:02d}:00–{self.close_hour % 24:02d}:00"

    @property
    def opens_at(self) -> str:
        return f"{self.open_hour:02d}:00"


def hours_for(category: str, always_busy: bool = False) -> OpeningHours:
    # Test venues stay open so the crowded state can be tried at any hour
    return OpeningHours(*(ALL_DAY if always_busy else HOURS_BY_CATEGORY.get(category, DEFAULT_HOURS)))


def local_hour(at: datetime, tz: str = settings.dummy_timezone) -> int:
    return at.astimezone(ZoneInfo(tz)).hour
