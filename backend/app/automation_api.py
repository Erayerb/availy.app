"""v2 endpoints: the business's automations (Ayarlar: ölü saat, otomatik kampanya; Kampanyalar: zamanlanmış)."""
from datetime import datetime

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.auth_api import current_user
from app.automation import (
    AutomationError,
    delete_schedule,
    get_settings,
    my_schedules,
    save_schedule,
    save_settings,
    set_schedule_active,
)
from app.checkins_api import get_clock
from app.db import get_conn

router = APIRouter(prefix="/v1/business")


class SettingsIO(BaseModel):
    dead_hour_alerts: bool
    auto_campaign: bool


class ScheduleIn(BaseModel):
    message: str = Field(..., max_length=200)
    discount: int | None = None
    radius_km: float = 2
    days: list[int] = Field(..., max_length=7)
    start_hour: int
    duration_hours: int


class ScheduleOut(BaseModel):
    id: int
    message: str
    discount: int | None
    radius_km: float
    days: list[int]
    start_hour: int
    duration_hours: int
    active: bool


class ActiveIn(BaseModel):
    active: bool


def _fail(e: AutomationError) -> HTTPException:
    return HTTPException(status_code=e.status, detail=e.message)


@router.get("/automation", response_model=SettingsIO)
def settings(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        return get_settings(conn, user)
    except AutomationError as e:
        raise _fail(e) from None


@router.put("/automation", response_model=SettingsIO)
def change_settings(
    body: SettingsIO, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)
):
    try:
        return save_settings(conn, user, body.dead_hour_alerts, body.auto_campaign, now)
    except AutomationError as e:
        raise _fail(e) from None


@router.get("/schedules", response_model=list[ScheduleOut])
def schedules(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        return my_schedules(conn, user)
    except AutomationError as e:
        raise _fail(e) from None


@router.post("/schedules", response_model=ScheduleOut, status_code=201)
def new_schedule(
    body: ScheduleIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)
):
    try:
        return save_schedule(conn, user, body.message, body.discount, body.radius_km, body.days, body.start_hour, body.duration_hours, now)
    except AutomationError as e:
        raise _fail(e) from None


@router.patch("/schedules/{schedule_id}", status_code=204)
def pause_schedule(schedule_id: int, body: ActiveIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        set_schedule_active(conn, user, schedule_id, body.active)
    except AutomationError as e:
        raise _fail(e) from None
    return Response(status_code=204)


@router.delete("/schedules/{schedule_id}", status_code=204)
def remove_schedule(schedule_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        delete_schedule(conn, user, schedule_id)
    except AutomationError as e:
        raise _fail(e) from None
    return Response(status_code=204)
