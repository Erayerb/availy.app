"""v2 business endpoints: the business's venue and its panel statistics."""
from datetime import datetime

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth_api import current_user
from app.business import BusinessError, reward_discoverer, set_business_venue, venue_stats
from app.checkins_api import get_clock
from app.db import get_conn

router = APIRouter(prefix="/v1")


class VenueIn(BaseModel):
    venue_id: int


class HourOut(BaseModel):
    hour: int
    checkins: int
    level: str | None  # average of what people said that hour


class Discoverer(BaseModel):
    username: str | None  # None when the check-in was private
    at: datetime
    can_reward: bool  # the account still exists
    reward: str | None  # what the business already sent


class RewardIn(BaseModel):
    message: str


class StatsOut(BaseModel):
    today: list[HourOut]
    today_checkins: int
    week_checkins: int
    week_people: int
    week_returning: int  # had been here before
    weekday: list[int]  # check-ins in the last 30 days, Monday first
    total_checkins: int
    discovered_by: Discoverer | None
    month_people: int = 0  # different people in the last 30 days
    regulars: int = 0  # of them, people with 3+ check-ins
    top_visits: list[int] = []  # check-ins of the 5 most frequent people (anonymous)


def _fail(e: BusinessError) -> HTTPException:
    return HTTPException(status_code=e.status, detail=e.message)


@router.get("/venues/taken", response_model=list[int])
def taken(conn: psycopg.Connection = Depends(get_conn)):
    """Venues that already have a business account (the venue setup list marks them)."""
    return [r["venue_id"] for r in conn.execute(
        "SELECT DISTINCT venue_id FROM users WHERE role = 'business' AND venue_id IS NOT NULL"
    ).fetchall()]


@router.put("/me/venue")
def my_venue(body: VenueIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """The business's venue, kept on the server (its replies get the "İşletme" mark, the panel its statistics)."""
    try:
        return set_business_venue(conn, user, body.venue_id)
    except BusinessError as e:
        raise _fail(e) from None


@router.get("/venues/{venue_id}/stats", response_model=StatsOut)
def stats(
    venue_id: int,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return venue_stats(conn, user, venue_id, now)
    except BusinessError as e:
        raise _fail(e) from None


@router.post("/venues/{venue_id}/discoverer-reward", status_code=201)
def reward(
    venue_id: int,
    body: RewardIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """"Ödül ver": once per venue, it reaches the discoverer as a notification."""
    try:
        return reward_discoverer(conn, user, venue_id, body.message, now)
    except BusinessError as e:
        raise _fail(e) from None
