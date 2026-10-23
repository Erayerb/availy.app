"""v2 check-in endpoint."""
from datetime import datetime, timezone
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth_api import current_user
from app.checkins import CheckinError, create_checkin
from app.db import get_conn

router = APIRouter(prefix="/v1")


def get_clock() -> datetime:
    """Current time; replaced in tests."""
    return datetime.now(timezone.utc)


class CheckinIn(BaseModel):
    level: Literal["low", "medium", "high"]
    queue: bool | None = None  # only with "high"
    seats: bool | None = None  # only with "medium"
    lat: float
    lon: float
    # Private: still counts for the occupancy, but the name is never shown to others
    private: bool = False


class CheckinCoupon(BaseModel):
    code: str
    message: str
    discount: int | None


class CheckinOut(BaseModel):
    id: int
    venue_id: int
    level: str
    queue: bool | None
    seats: bool | None
    is_first: bool
    created_at: datetime
    is_private: bool
    points_earned: int
    points_note: str | None = None  # no points: "too_soon" (30 min since the last) or "daily_limit"
    visitor_rank: int | None  # "Burayı keşfeden 12. kişisin" (first visit only)
    my_visits: int
    coupons: list[CheckinCoupon] = []  # from "Check-in yapana kupon" campaigns


class VisitOut(BaseModel):
    venue_id: int
    visits: int
    last_at: datetime


@router.get("/me/visits", response_model=list[VisitOut])
def visits(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    from app.checkins import user_visits

    return user_visits(conn, user["id"])


@router.post("/venues/{venue_id}/checkins", response_model=CheckinOut, status_code=201)
def checkin(
    venue_id: int,
    body: CheckinIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return create_checkin(
            conn, user, venue_id, body.level, body.queue, body.seats, body.lat, body.lon, now, body.private
        )
    except CheckinError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None
