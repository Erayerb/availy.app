"""v2 campaign and coupon endpoints."""
from datetime import datetime

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.auth_api import current_user
from app.campaigns import (
    CampaignError,
    active_campaigns,
    claim_coupon,
    create_campaign,
    end_campaign,
    hide_campaigns,
    my_campaigns,
    my_coupons,
    record_view,
    redeem_coupon,
    venue_coupons,
)
from app.checkins_api import get_clock
from app.db import get_conn

router = APIRouter(prefix="/v1")


class CampaignIn(BaseModel):
    message: str
    discount: int | None = None
    radius_km: float
    max_claims: int | None = None
    duration_hours: int


class CampaignOut(BaseModel):
    id: int
    venue_id: int
    venue_name: str
    lat: float
    lon: float
    message: str
    discount: int | None
    radius_km: float
    max_claims: int | None
    duration_hours: int
    starts_at: datetime
    ends_at: datetime
    claims: int
    redemptions: int
    views: int


class CouponOut(BaseModel):
    code: str
    campaign_id: int
    venue_id: int
    venue_name: str
    message: str
    discount: int | None
    claimed_at: datetime
    redeemed_at: datetime | None
    ends_at: datetime


class HideIn(BaseModel):
    ids: list[int]


class CodeIn(BaseModel):
    code: str


def _fail(e: CampaignError) -> HTTPException:
    return HTTPException(status_code=e.status, detail=e.message)


@router.get("/campaigns", response_model=list[CampaignOut])
def running(conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    return active_campaigns(conn, now)


@router.post("/campaigns", response_model=CampaignOut, status_code=201)
def create(
    body: CampaignIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return create_campaign(conn, user, body.message, body.discount, body.radius_km, body.max_claims, body.duration_hours, now)
    except CampaignError as e:
        raise _fail(e) from None


@router.get("/me/campaigns", response_model=list[CampaignOut])
def mine(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    try:
        return my_campaigns(conn, user)
    except CampaignError as e:
        raise _fail(e) from None


@router.post("/campaigns/{campaign_id}/end", response_model=CampaignOut)
def end(
    campaign_id: int,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return end_campaign(conn, user, campaign_id, now)
    except CampaignError as e:
        raise _fail(e) from None


@router.post("/campaigns/hide", status_code=204)
def hide(
    body: HideIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        hide_campaigns(conn, user, body.ids, now)
    except CampaignError as e:
        raise _fail(e) from None
    return Response(status_code=204)


@router.post("/campaigns/{campaign_id}/view", status_code=204)
def view(campaign_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    record_view(conn, user, campaign_id)
    return Response(status_code=204)


@router.post("/campaigns/{campaign_id}/coupon", response_model=CouponOut)
def claim(
    campaign_id: int,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return claim_coupon(conn, user, campaign_id, now)
    except CampaignError as e:
        raise _fail(e) from None


@router.get("/me/coupons", response_model=list[CouponOut])
def coupons(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """A customer's coupons; for a business, the coupons taken for its campaigns."""
    try:
        return venue_coupons(conn, user) if user.get("role") == "business" else my_coupons(conn, user)
    except CampaignError as e:
        raise _fail(e) from None


@router.post("/coupons/redeem", response_model=CouponOut)
def redeem(
    body: CodeIn,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    try:
        return redeem_coupon(conn, user, body.code, now)
    except CampaignError as e:
        raise _fail(e) from None
