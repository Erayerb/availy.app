"""v2 loyalty endpoints (customers join, businesses run their program and stamp members)."""
from datetime import datetime

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.auth_api import current_user
from app.checkins_api import get_clock
from app.db import get_conn
from app.loyalty import (
    LoyaltyError,
    give_stamp,
    join,
    leave,
    my_program,
    programs_for,
    remove_program,
    save_program,
    use_reward,
)
from app.reviews_api import optional_user

router = APIRouter(prefix="/v1")


class MemberOut(BaseModel):
    stamps: int
    rewards: int
    total_stamps: int
    joined_at: datetime


class ProgramOut(BaseModel):
    venue_id: int
    venue_name: str
    kind: str
    stamps_required: int
    reward: str
    price: int
    perk: str
    active: bool
    member: MemberOut | None = None


class MyProgramOut(BaseModel):
    program: ProgramOut | None
    members: int
    stamps_given: int


class ProgramIn(BaseModel):
    kind: str
    stamps_required: int = 5
    reward: str = ""
    price: int = 0
    perk: str = ""
    active: bool = True


class CodeIn(BaseModel):
    code: str


class MessageOut(BaseModel):
    message: str


def _fail(e: LoyaltyError) -> HTTPException:
    return HTTPException(status_code=e.status, detail=e.message)


@router.get("/loyalty", response_model=list[ProgramOut])
def programs(me: dict | None = Depends(optional_user), conn: psycopg.Connection = Depends(get_conn)):
    return programs_for(conn, me)


@router.post("/loyalty/{venue_id}/join", status_code=204)
def join_program(
    venue_id: int,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        join(conn, user, venue_id, now)
    except LoyaltyError as e:
        raise _fail(e) from None
    return Response(status_code=204)


@router.delete("/loyalty/{venue_id}/join", status_code=204)
def leave_program(venue_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    leave(conn, user, venue_id)
    return Response(status_code=204)


@router.get("/me/loyalty", response_model=MyProgramOut)
def mine(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        return my_program(conn, user)
    except LoyaltyError as e:
        raise _fail(e) from None


@router.put("/me/loyalty", response_model=MyProgramOut)
def save(
    body: ProgramIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return save_program(conn, user, body.kind, body.stamps_required, body.reward, body.price, body.perk, body.active, now)
    except LoyaltyError as e:
        raise _fail(e) from None


@router.delete("/me/loyalty", status_code=204)
def remove(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        remove_program(conn, user)
    except LoyaltyError as e:
        raise _fail(e) from None
    return Response(status_code=204)


@router.post("/me/loyalty/stamp", response_model=MessageOut)
def stamp(body: CodeIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        return {"message": give_stamp(conn, user, body.code)}
    except LoyaltyError as e:
        raise _fail(e) from None


@router.post("/me/loyalty/reward", response_model=MessageOut)
def reward(body: CodeIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        return {"message": use_reward(conn, user, body.code)}
    except LoyaltyError as e:
        raise _fail(e) from None
