"""v2 endpoints: venue lists (Favoriler > Listelerim), shared with friends or by link."""
from datetime import datetime
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.auth_api import current_user
from app.checkins_api import get_clock
from app.db import get_conn
from app.lists import (
    ListError,
    create_list,
    delete_list,
    get_list,
    list_by_code,
    my_lists,
    save_copy,
    set_item,
    update_list,
    user_lists,
)

router = APIRouter(prefix="/v1")

Visibility = Literal["private", "friends", "link"]


class ListOut(BaseModel):
    id: int
    name: str
    visibility: Visibility
    share_code: str | None  # only for the owner
    owner: str | None
    mine: bool
    venue_ids: list[int]  # newest first


class ListIn(BaseModel):
    name: str = Field(..., max_length=80)
    visibility: Visibility = "private"
    venue_ids: list[int] = Field(default_factory=list, max_length=200)


class ListPatch(BaseModel):
    name: str | None = Field(None, max_length=80)
    visibility: Visibility | None = None


class ItemIn(BaseModel):
    present: bool


def _fail(e: ListError) -> HTTPException:
    return HTTPException(status_code=e.status, detail=e.message)


def _out(row: dict) -> dict:
    # The share code is the owner's to give out
    return {**row, "share_code": row["share_code"] if row["mine"] else None}


@router.get("/lists", response_model=list[ListOut])
def lists(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    return [_out(r) for r in my_lists(conn, user)]


@router.post("/lists", response_model=ListOut, status_code=201)
def new_list(body: ListIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    try:
        return _out(create_list(conn, user, body.name, body.visibility, now, body.venue_ids))
    except ListError as e:
        raise _fail(e) from None


@router.get("/lists/shared/{code}", response_model=ListOut)
def shared_list(code: str, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """A list opened from its link."""
    try:
        return _out(list_by_code(conn, user, code))
    except ListError as e:
        raise _fail(e) from None


@router.get("/lists/{list_id}", response_model=ListOut)
def one_list(list_id: int, code: str | None = None, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        return _out(get_list(conn, user, list_id, code))
    except ListError as e:
        raise _fail(e) from None


@router.patch("/lists/{list_id}", response_model=ListOut)
def change_list(list_id: int, body: ListPatch, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        return _out(update_list(conn, user, list_id, body.name, body.visibility))
    except ListError as e:
        raise _fail(e) from None


@router.delete("/lists/{list_id}", status_code=204)
def remove_list(list_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    delete_list(conn, user, list_id)
    return Response(status_code=204)


@router.put("/lists/{list_id}/venues/{venue_id}", response_model=ListOut)
def list_item(
    list_id: int,
    venue_id: int,
    body: ItemIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """Adds the venue to the list (present: true) or takes it out."""
    try:
        return _out(set_item(conn, user, list_id, venue_id, body.present, now))
    except ListError as e:
        raise _fail(e) from None


@router.post("/lists/{list_id}/save", response_model=ListOut, status_code=201)
def save_list(
    list_id: int,
    code: str | None = None,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """"Listeyi kaydet": a private copy for me."""
    try:
        return _out(save_copy(conn, user, list_id, code, now))
    except ListError as e:
        raise _fail(e) from None


@router.get("/users/{username}/lists", response_model=list[ListOut])
def lists_of(username: str, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    return [_out(r) for r in user_lists(conn, user, username)]
