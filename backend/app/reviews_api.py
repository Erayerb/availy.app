"""v2 endpoints: venue reviews, replies and the friends' feed."""
from datetime import datetime
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel, Field

from app.accounts import user_for_token
from app.auth_api import bearer_token, current_user
from app.checkins_api import get_clock
from app.db import get_conn
from app.reviews import (
    MAX_BODY,
    ReviewError,
    add_reply,
    delete_reply,
    delete_review,
    friend_feed,
    save_review,
    venue_reviews,
)

router = APIRouter(prefix="/v1")


def optional_user(authorization: str | None = Header(None), conn: psycopg.Connection = Depends(get_conn)) -> dict | None:
    """The signed-in user if a valid token is sent; reading reviews works without one."""
    token = bearer_token(authorization)
    return user_for_token(conn, token) if token else None


class ReplyOut(BaseModel):
    id: int
    username: str | None
    body: str
    created_at: datetime
    mine: bool
    is_business: bool = False  # written by the venue's own business account ("İşletme")


class ReviewOut(BaseModel):
    id: int
    username: str | None
    rating: int
    body: str
    allow_replies: bool
    created_at: datetime
    mine: bool
    replies: list[ReplyOut]


class ReviewsOut(BaseModel):
    average: float | None
    count: int
    items: list[ReviewOut]


class ReviewIn(BaseModel):
    rating: int
    body: str = Field("", max_length=MAX_BODY + 50)
    allow_replies: bool = True


class ReplyIn(BaseModel):
    body: str = Field(..., max_length=MAX_BODY + 50)


class FeedItem(BaseModel):
    kind: Literal["checkin", "review", "reply"]
    at: datetime
    username: str | None
    venue_id: int
    venue_name: str
    is_first: bool  # check-in: the venue's first ("keşfetti")
    points: int  # check-in: points earned
    rating: int | None  # review
    body: str | None  # review / reply text
    review_author: str | None  # reply: whose review it answers
    review_id: int | None  # review / reply: to answer from the feed
    allow_replies: bool


def _fail(error: ReviewError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.message)


@router.get("/venues/{venue_id}/reviews", response_model=ReviewsOut)
def reviews(venue_id: int, me: dict | None = Depends(optional_user), conn: psycopg.Connection = Depends(get_conn)):
    return venue_reviews(conn, venue_id, me)


@router.post("/venues/{venue_id}/reviews", response_model=ReviewsOut, status_code=201)
def write_review(
    venue_id: int,
    body: ReviewIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        save_review(conn, user, venue_id, body.rating, body.body, body.allow_replies, now)
    except ReviewError as e:
        raise _fail(e) from None
    return venue_reviews(conn, venue_id, user)


@router.delete("/reviews/{review_id}", status_code=204)
def remove_review(review_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    delete_review(conn, user, review_id)
    return Response(status_code=204)


@router.post("/reviews/{review_id}/replies", status_code=201)
def reply(
    review_id: int,
    body: ReplyIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return add_reply(conn, user, review_id, body.body, now)
    except ReviewError as e:
        raise _fail(e) from None


@router.delete("/replies/{reply_id}", status_code=204)
def remove_reply(reply_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    delete_reply(conn, user, reply_id)
    return Response(status_code=204)


@router.get("/feed", response_model=list[FeedItem])
def feed(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    """Friends' check-ins, reviews and replies of the last 7 days (the Sosyal > Akış list)."""
    return friend_feed(conn, user, now)
