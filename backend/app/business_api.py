"""v2 business endpoints: the business's venue and its panel statistics."""
from datetime import datetime

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth_api import current_user
from app.business import BusinessError, set_business_venue, venue_stats
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
    username: str | None
    at: datetime


class StatsOut(BaseModel):
    today: list[HourOut]
    today_checkins: int
    week_checkins: int
    week_people: int
    week_new: int  # first time at this venue
    week_returning: int  # had been here before
    weekday: list[int]  # check-ins in the last 30 days, Monday first
    total_checkins: int
    discovered_by: Discoverer | None


def _fail(e: BusinessError) -> HTTPException:
    return HTTPException(status_code=e.status, detail=e.message)


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
