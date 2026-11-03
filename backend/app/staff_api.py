"""v2 endpoints: Çalışan hesapları. The counter itself uses POST /v1/coupons/redeem and /v1/me/loyalty/stamp, /reward."""
from datetime import datetime

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.auth_api import current_user
from app.checkins_api import get_clock
from app.db import get_conn
from app.staff import StaffError, create_invite, join_with_code, leave_workplace, my_staff, my_workplace, remove_staff

router = APIRouter(prefix="/v1/staff")


def _fail(e: StaffError) -> HTTPException:
    return HTTPException(status_code=e.status, detail=e.message)


class InviteOut(BaseModel):
    code: str
    expires_at: datetime


class StaffOut(BaseModel):
    id: int
    username: str | None
    joined_at: datetime
    coupons: int
    stamps: int
    rewards: int


class WorkplaceOut(BaseModel):
    venue_id: int
    venue_name: str
    joined_at: datetime
    has_stamps: bool | None  # an active stamp card to work


class JoinIn(BaseModel):
    code: str = Field(..., max_length=20)


@router.post("/invite", response_model=InviteOut, status_code=201)
def invite(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    """The business: a one-time code, valid for 7 days."""
    try:
        return create_invite(conn, user, now)
    except StaffError as e:
        raise _fail(e) from None


@router.get("", response_model=list[StaffOut])
def staff(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        return my_staff(conn, user)
    except StaffError as e:
        raise _fail(e) from None


@router.post("/join", response_model=WorkplaceOut)
def join(body: JoinIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    try:
        return join_with_code(conn, user, body.code, now)
    except StaffError as e:
        raise _fail(e) from None


@router.get("/me", response_model=WorkplaceOut | None)
def workplace(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    return my_workplace(conn, user)


@router.delete("/me", status_code=204)
def leave(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    leave_workplace(conn, user)
    return Response(status_code=204)


# After /me: "me" is not a staff id
@router.delete("/{staff_id}", status_code=204)
def remove(staff_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        remove_staff(conn, user, staff_id)
    except StaffError as e:
        raise _fail(e) from None
    return Response(status_code=204)
