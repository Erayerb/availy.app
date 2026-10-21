"""Opening hours (demo): by venue category, in Istanbul local time.

A closing hour <= opening hour means the venue closes after midnight
(e.g. a bar open 17:00-03:00).
"""
import re
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
    "park": (0, 24),
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


def venue_hours(venue: dict) -> OpeningHours:
    """The venue's own hours when the data source has them (e.g. OpenStreetMap), else the category's."""
    if venue.get("open_hour") is not None and venue.get("close_hour") is not None:
        return OpeningHours(venue["open_hour"], venue["close_hour"])
    return hours_for(venue["category"], venue.get("always_busy", False))


_RANGE = re.compile(r"^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$")
_EVERY_DAY = {"", "Mo-Su", "Mo-Su,PH", "Mo-Su, PH"}


def parse_opening_hours(text: str | None) -> tuple[int, int] | None:
    """Simple OpenStreetMap opening_hours ("24/7", "Mo-Su 08:00-23:00", "09:00-01:00") -> (open, close) hour.

    Only one daily range for every day is understood; anything else returns None (category default).
    Minutes are rounded outwards (open 08:30 -> 8, close 23:30 -> 24).
    """
    if not text:
        return None
    text = text.strip()
    if text == "24/7":
        return (0, 24)
    days, _, times = text.rpartition(" ")
    match = _RANGE.match(times)
    if not match or days.strip() not in _EVERY_DAY:
        return None
    open_h, _open_m, close_h, close_m = (int(x) for x in match.groups())
    if not (0 <= open_h <= 23 and 0 <= close_h <= 24):
        return None
    close = close_h + (1 if close_m > 0 else 0)  # 23:30 -> 24
    if close == 0:
        close = 24  # "…-00:00" closes at midnight
    if close > 24 or close == open_h:
        return None
    # A closing hour below the opening hour means after midnight (e.g. 17:00-02:00), as elsewhere
    return (open_h, close)


def local_hour(at: datetime, tz: str = settings.dummy_timezone) -> int:
    return at.astimezone(ZoneInfo(tz)).hour
