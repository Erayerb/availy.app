from datetime import datetime
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.auth_api import current_user
from app.checkins_api import get_clock
from app.db import get_conn
from app.moderation import ModerationError
from app.sponsors import (
    SponsorError,
    admin_overview,
    business_status,
    count_event,
    request_sponsorship,
    start_sponsorship,
    stop_sponsorship,
)

router = APIRouter(prefix="/v1")


def _fail(e: SponsorError | ModerationError) -> HTTPException:
    return HTTPException(status_code=e.status, detail=e.message)


class EventIn(BaseModel):
    kind: Literal["view", "tap"]


@router.post("/venues/{venue_id}/sponsor-events", status_code=204)
def event(venue_id: int, body: EventIn, conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    count_event(conn, venue_id, body.kind, now)
    return Response(status_code=204)


class PeriodOut(BaseModel):
    starts_at: datetime
    ends_at: datetime


class StatusOut(BaseModel):
    active: PeriodOut | None
    requested_days: int | None
    views: int
    taps: int
    checkins: int


@router.get("/business/sponsorship", response_model=StatusOut)
def status(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    if user["role"] != "business" or not user.get("venue_id"):
        raise HTTPException(status_code=403, detail="Önce mekanını seç.")
    return business_status(conn, user["venue_id"], now)


class RequestIn(BaseModel):
    days: Literal[7, 30]


@router.post("/business/sponsorship", response_model=StatusOut)
def ask(body: RequestIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    try:
        request_sponsorship(conn, user, body.days)
    except SponsorError as e:
        raise _fail(e) from None
    return business_status(conn, user["venue_id"], now)


class AdminRequestOut(BaseModel):
    venue_id: int
    venue_name: str
    days: int
    created_at: datetime


class AdminActiveOut(BaseModel):
    venue_id: int
    venue_name: str
    ends_at: datetime


class OverviewOut(BaseModel):
    requests: list[AdminRequestOut]
    active: list[AdminActiveOut]


@router.get("/admin/sponsorships", response_model=OverviewOut)
def overview(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    try:
        return admin_overview(conn, user, now)
    except ModerationError as e:
        raise _fail(e) from None


class StartIn(BaseModel):
    days: Literal[7, 30]


@router.post("/admin/sponsorships/{venue_id}", status_code=204)
def start(venue_id: int, body: StartIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    try:
        start_sponsorship(conn, user, venue_id, body.days, now)
    except (SponsorError, ModerationError) as e:
        raise _fail(e) from None
    return Response(status_code=204)


@router.delete("/admin/sponsorships/{venue_id}", status_code=204)
def stop(venue_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    try:
        stop_sponsorship(conn, user, venue_id, now)
    except ModerationError as e:
        raise _fail(e) from None
    return Response(status_code=204)
