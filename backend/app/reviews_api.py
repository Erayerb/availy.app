"""v2 endpoints: venue reviews, replies and the friends' feed."""
from datetime import datetime
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.accounts import user_for_token
from app.auth_api import bearer_token, current_user
from app.checkins_api import get_clock
from app.checkin_social import SocialError, comment, delete_comment, like, social_for
from app.db import get_conn
from app.reviews import (
    MAX_BODY,
    ReviewError,
    add_reply,
    delete_reply,
    delete_review,
    edit_review,
    friend_feed,
    replies_for,
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


class AllowanceOut(BaseModel):
    checkins: int  # my check-ins at the venue
    left: int  # reviews I may still write there (2 per check-in)


class ReviewsOut(BaseModel):
    average: float | None
    count: int
    items: list[ReviewOut]
    allowance: AllowanceOut | None = None


class ReviewIn(BaseModel):
    rating: int
    body: str = Field("", max_length=MAX_BODY + 50)
    allow_replies: bool = True
    checkin_id: int | None = None  # written right after this check-in


class ReviewEditIn(BaseModel):
    rating: int
    body: str = Field("", max_length=MAX_BODY + 50)


class ReplyIn(BaseModel):
    body: str = Field(..., max_length=MAX_BODY + 50)


class CheckinCommentOut(BaseModel):
    id: int
    username: str | None
    body: str
    at: datetime
    mine: bool


class FeedItem(BaseModel):
    kind: Literal["checkin", "review", "reply"]
    at: datetime
    username: str | None
    venue_id: int
    venue_name: str
    is_first: bool  # check-in: the venue's first ("keşfetti")
    points: int  # check-in: points earned
    rating: int | None  # review
    body: str | None  # review / reply text, or the check-in's note ("Fikrini yaz")
    review_author: str | None  # reply: whose review it answers
    review_id: int | None  # review / reply: to answer from the feed
    allow_replies: bool
    # Check-in: id, likes and friends' comments
    checkin_id: int | None = None
    likes: int = 0
    liked: bool = False
    likers: list[str] = []  # the last 3 who liked it
    comments: list[CheckinCommentOut] = []
    # Replies under the review, shown attached to it
    replies: list[CheckinCommentOut] = []


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
        save_review(conn, user, venue_id, body.rating, body.body, body.allow_replies, now, body.checkin_id)
    except ReviewError as e:
        raise _fail(e) from None
    return venue_reviews(conn, venue_id, user)


@router.patch("/reviews/{review_id}", response_model=ReviewsOut)
def change_review(
    review_id: int, body: ReviewEditIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)
):
    try:
        venue_id = edit_review(conn, user, review_id, body.rating, body.body)
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
def feed(
    days: int = Query(3, ge=1, le=30),
    who: Literal["friends", "me"] = "friends",
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """Check-ins, reviews and replies: friends' (Sosyal > Arkadaşlarım) or mine (who=me, Sosyal > Akış);
    friends: the last 3 days, up to 7 with "Daha eski"; mine: 7, up to 30."""
    items = friend_feed(conn, user, now, days, who)
    social = social_for(conn, user, [i["checkin_id"] for i in items if i["checkin_id"]])
    replies = replies_for(conn, user, [i["review_id"] for i in items if i["review_id"] and i["kind"] != "reply"])
    return [
        {**i, **social.get(i["checkin_id"], {}), "replies": replies.get(i["review_id"], []) if i["kind"] != "reply" else []}
        for i in items
    ]


class LikeIn(BaseModel):
    liked: bool


class CommentIn(BaseModel):
    body: str


def _social_fail(e: SocialError) -> HTTPException:
    return HTTPException(status_code=e.status, detail=e.message)


@router.put("/checkins/{checkin_id}/like", status_code=204)
def checkin_like(
    checkin_id: int,
    body: LikeIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        like(conn, user, checkin_id, body.liked, now)
    except SocialError as e:
        raise _social_fail(e) from None
    return Response(status_code=204)


@router.post("/checkins/{checkin_id}/comments", status_code=201)
def checkin_comment(
    checkin_id: int,
    body: CommentIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return comment(conn, user, checkin_id, body.body, now)
    except SocialError as e:
        raise _social_fail(e) from None


@router.delete("/checkin-comments/{comment_id}", status_code=204)
def checkin_comment_delete(comment_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    delete_comment(conn, user, comment_id)
    return Response(status_code=204)
