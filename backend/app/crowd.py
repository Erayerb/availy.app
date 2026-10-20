"""v2: a venue's occupancy from recent check-ins (the "crowd").

Pure functions, so the model can be tested and changed in one place.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal

from app.occupancy import classify

WINDOW = timedelta(minutes=90)  # only check-ins this recent count
HALF_LIFE_MINUTES = 30  # a report half as old weighs twice as much
MIN_REPORTERS_FOR_RATIO = 3  # below this only the level is shown, no "~%60"
LEVEL_SCORE = {"low": 0.2, "medium": 0.55, "high": 0.9}
DEFAULT_TRUST = 1.0

State = Literal["live", "stale", "unexplored"]


@dataclass(frozen=True)
class Report:
    user_id: int | None  # None once anonymised
    level: str
    queue: bool | None
    seats: bool | None
    created_at: datetime
    trust: float = DEFAULT_TRUST


@dataclass(frozen=True)
class Crowd:
    state: State
    level: str | None = None
    ratio: float | None = None  # only with at least MIN_REPORTERS_FOR_RATIO people
    reporters: int = 0  # distinct people in the last 90 minutes
    last_report_at: datetime | None = None
    queue: bool | None = None  # "Sıra var" (from Kalabalık reports)
    seats: bool | None = None  # "Oturacak yer var" (from Orta reports)


def age_weight(created_at: datetime, now: datetime) -> float:
    minutes = max((now - created_at).total_seconds() / 60, 0)
    return 0.5 ** (minutes / HALF_LIFE_MINUTES)


def latest_per_person(reports: list[Report]) -> list[Report]:
    """A person counts once: only their newest report in the window."""
    latest: dict[object, Report] = {}
    for i, r in enumerate(reports):
        key = r.user_id if r.user_id is not None else f"anon-{i}"
        if key not in latest or r.created_at > latest[key].created_at:
            latest[key] = r
    return list(latest.values())


def _weighted_answer(pairs: list[tuple[bool, float]]) -> bool | None:
    """Weighted yes/no majority; None without answers or on a tie."""
    yes = sum(w for answer, w in pairs if answer)
    no = sum(w for answer, w in pairs if not answer)
    if yes == no:
        return None
    return yes > no


def crowd_from_checkins(reports: list[Report], last_report_at: datetime | None, now: datetime) -> Crowd:
    """`reports`: the venue's check-ins (any age); `last_report_at`: its newest check-in ever (None = never)."""
    if last_report_at is None:
        return Crowd(state="unexplored")
    recent = latest_per_person([r for r in reports if now - WINDOW < r.created_at <= now])
    if not recent:
        return Crowd(state="stale", last_report_at=last_report_at)

    weights = [age_weight(r.created_at, now) * r.trust for r in recent]
    total = sum(weights)
    score = sum(w * LEVEL_SCORE[r.level] for r, w in zip(recent, weights)) / total if total > 0 else 0.5
    level = classify(score).value
    queue = _weighted_answer([(r.queue, w) for r, w in zip(recent, weights) if r.queue is not None])
    seats = _weighted_answer([(r.seats, w) for r, w in zip(recent, weights) if r.seats is not None])
    return Crowd(
        state="live",
        level=level,
        ratio=round(score, 2) if len(recent) >= MIN_REPORTERS_FOR_RATIO else None,
        reporters=len(recent),
        last_report_at=max(r.created_at for r in recent),
        queue=queue if level == "high" else None,
        seats=seats if level == "medium" else None,
    )
