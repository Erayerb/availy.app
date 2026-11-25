"""v2 business endpoints: the business's venue and its panel statistics."""
from datetime import datetime

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth_api import current_user
from app.reviews_api import optional_user
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
    username: str | None  # None when the check-in was private
    at: datetime
    can_reward: bool  # the account still exists
    reward: str | None  # what the business already sent


class QuietSlot(BaseModel):
    weekday: int  # Monday = 0
    start_hour: int
    hours: int
    checkins: int


class StatsOut(BaseModel):
    today: list[HourOut]
    today_checkins: int
    week_checkins: int
    week_people: int
    week_returning: int  # had been here before
    weekday: list[int]  # check-ins in the last 30 days, Monday first
    quiet_slot: QuietSlot | None = None  # the emptiest two hours of the week
    total_checkins: int
    discovered_by: Discoverer | None
    month_people: int = 0  # different people in the last 30 days
    regulars: int = 0  # of them, people with 3+ check-ins
    top_visits: list[int] = []  # check-ins of the 5 most frequent people (anonymous)
    month_checkins: int = 0  # this month so far
    last_month_checkins: int = 0  # the same days of last month
    month_change_pct: int | None = None  # +20 = 20% more than last month (None: nothing last month)


def _fail(e: BusinessError) -> HTTPException:
    return HTTPException(status_code=e.status, detail=e.message)


@router.get("/venues/taken", response_model=list[int])
def taken(conn: psycopg.Connection = Depends(get_conn)):
    """Venues that already have a business account (the venue setup list marks them)."""
    return [r["venue_id"] for r in conn.execute(
        "SELECT DISTINCT venue_id FROM users WHERE role = 'business' AND venue_id IS NOT NULL"
    ).fetchall()]


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


class AccessOut(BaseModel):
    plan: str  # saas / pay_per_use (Ücretsiz)
    founder: bool
    verified: bool
    stats: bool  # İstatistikler: in the monthly plan (and for founder venues)
    free_campaigns_per_month: int
    free_campaigns_left: int  # this month (verified venues)
    next_campaign: str  # saas / founder / free / unverified (verify first) / blocked (this month's are used)
    trial_until: datetime | None = None  # 15-day trial of the Aylık paket, running
    trial_available: bool = False
    founder_until: datetime | None = None  # kurucu mekan: the free Aylık paket ends then


class PlanIn(BaseModel):
    plan: str


@router.get("/business/plan", response_model=AccessOut)
def plan(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    from app.plans import PlanError, business_access

    try:
        return business_access(conn, user, now)
    except PlanError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None


@router.put("/business/plan", response_model=AccessOut)
def change_plan(body: PlanIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """Prototype: choosing the plan switches it (no payment yet)."""
    from app.plans import PlanError, set_business_plan

    try:
        return set_business_plan(conn, user, body.plan)
    except PlanError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None



@router.post("/business/trial", response_model=AccessOut)
def trial(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    """"15 gün ücretsiz dene": the Aylık paket, once per venue."""
    from app.plans import PlanError, start_trial

    try:
        return start_trial(conn, user, now)
    except PlanError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None


class ReportOut(BaseModel):
    month: str
    checkins: int
    people: int
    new_people: int  # first time at the venue this month
    coupons_used: int
    campaigns: int


@router.get("/business/report", response_model=ReportOut)
def report(
    months_back: int = 0,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """"availo bu ay size X müşteri getirdi" (every plan)."""
    from app.business import business_report

    try:
        return business_report(conn, user, now, months_back)
    except BusinessError as e:
        raise _fail(e) from None


class PitchOut(BaseModel):
    week_checkins: int
    week_people: int
    busiest_hour: int | None
    favorites: int
    month_checkins: int
    reviews: int
    rating: float | None
    joined: bool  # the venue has a business account already
    nearby_joined: int  # venues within 1 km that have one


@router.get("/admin/venues/{venue_id}/pitch", response_model=PitchOut)
def pitch(venue_id: int, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    """Yönetici: the numbers to show a venue that has not joined."""
    from app.business import sales_pitch
    from app.moderation import ModerationError

    try:
        return sales_pitch(conn, user, venue_id, now)
    except ModerationError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None


class RewardIn(BaseModel):
    points: int
    discount: int
    active: bool = True


class RewardOut(BaseModel):
    id: int
    points: int
    discount: int
    active: bool


@router.get("/business/reward", response_model=RewardOut | None)
def get_reward(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    from app.campaigns import CampaignError, my_reward

    try:
        return my_reward(conn, user, now)
    except CampaignError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None


@router.put("/business/reward", response_model=RewardOut)
def put_reward(body: RewardIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    """Kalıcı ödül: "200 puan = %10 indirim" on the venue page, once a week per person."""
    from app.campaigns import CampaignError, save_reward

    try:
        return save_reward(conn, user, body.points, body.discount, body.active, now)
    except CampaignError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None


class VenueRewardOut(BaseModel):
    campaign_id: int
    points: int
    discount: int
    next_at: datetime | None  # when I may take it again (None: now)
    free: str | None = None  # without points for me: "welcome" (Kâşif's gift)


@router.get("/venues/{venue_id}/reward", response_model=VenueRewardOut | None)
def venue_reward_view(
    venue_id: int,
    user: dict | None = Depends(optional_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    from app.campaigns import venue_reward

    return venue_reward(conn, venue_id, user, now)


class TodayOut(BaseModel):
    checkins: int
    people: int
    new_people: int  # first time at the venue


@router.get("/business/today", response_model=TodayOut)
def today(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    """Every plan: today's check-ins and new customers."""
    from app.business import today_basics

    try:
        return today_basics(conn, user, now)
    except BusinessError as e:
        raise _fail(e) from None


class BusinessSummaryOut(ReportOut):
    months_available: int  # the month picker: back to the month the business joined
    returning_people: int
    previous_checkins: int
    previous_people: int
    busiest_weekday: int | None  # 1 = Monday
    busiest_hour: int | None
    regulars: int  # came on 3+ days this month


@router.get("/business/monthly-summary", response_model=BusinessSummaryOut)
def business_summary(
    months_back: int = 0,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """Aylık paket: the month, visual (the app shows it as pages)."""
    from app.business import business_monthly_summary

    try:
        return business_monthly_summary(conn, user, now, months_back)
    except BusinessError as e:
        raise _fail(e) from None
