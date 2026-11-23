"""v2 endpoints: leaderboard (Sosyal > Sıralama) and notifications (🔔)."""
from datetime import datetime
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.auth_api import current_user
from app.checkins_api import get_clock
from app.db import get_conn
from app.groups import is_member
from app.social import CallError, call_friends, clear_notifications, dismiss_notification, leaderboard, notifications
from app.suggestions import discovered_venues, suggested_people

router = APIRouter(prefix="/v1")


class RankRow(BaseModel):
    rank: int
    username: str | None
    points: int
    me: bool
    level: str | None = None  # the level's id, for its icon next to the name


class MyRank(BaseModel):
    rank: int
    points: int


class LeaderboardOut(BaseModel):
    rows: list[RankRow]
    me: MyRank | None
    last_week_winners: list[str] = []  # "Haftanın 1.si"


class NotificationOut(BaseModel):
    kind: Literal[
        "friend_request",
        "friend_accepted",
        "reply",
        "reward",
        "loyalty",
        "checkin_like",
        "checkin_comment",
        "group_invite",
        "dead_hour",
        "auto_campaign",
        "come_here",
        "friend_checkin",
        "together",
        "venue_approved",
        "invite_joined",
        "loyalty_reward",
        "weekly_winner",
        "support_reply",
        "moment_removed",
        "moment_report_result",
        "report_result",
        "watch_quiet",
        "new_review",
        "sponsor_started",
        "sponsor_ended",
        "venue_issue",
        "friend_review",
        "favorite_quiet",
        "coupon_redeemed",
        "coupon_limit",
        "campaign_ended",
        "comeback",
        "monthly_report",
        "trial_ended",
        "founder_ended",
    ]
    at: datetime
    username: str | None
    venue_id: int | None
    venue_name: str | None
    body: str | None
    done: bool = False  # a request accepted, a loyalty program joined
    key: str  # for deleting it


class DismissIn(BaseModel):
    key: str


class CalledOut(BaseModel):
    friends: int


@router.post("/checkins/{checkin_id}/call-friends", response_model=CalledOut)
def call(
    checkin_id: int,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """"Buradayım, gel" after a check-in."""
    try:
        return {"friends": call_friends(conn, user, checkin_id, now)}
    except CallError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None


@router.get("/leaderboard", response_model=LeaderboardOut)
def ranking(
    period: Literal["week", "all"] = "week",
    scope: Literal["friends", "everyone", "group"] = "friends",
    group: int | None = None,  # scope "group": which one (I must be a member)
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    if scope == "group" and (group is None or not is_member(conn, group, user["id"])):
        raise HTTPException(status_code=404, detail="Grup bulunamadı.")
    return leaderboard(conn, user, period, scope, now, group)


@router.get("/notifications", response_model=list[NotificationOut])
def my_notifications(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    return notifications(conn, user, now)


@router.post("/notifications/dismiss", status_code=204)
def dismiss(body: DismissIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """🗑 on one 🔔 item."""
    dismiss_notification(conn, user, body.key)
    return Response(status_code=204)


@router.delete("/notifications", status_code=204)
def clear(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    """"Temizle": deletes the whole 🔔 list."""
    clear_notifications(conn, user, now)
    return Response(status_code=204)


class SuggestedPerson(BaseModel):
    username: str
    mutual: int  # friends we have in common
    shared_venues: int = 0  # venues we both checked in at
    week_points: int


class DiscoveredVenue(BaseModel):
    id: int
    name: str
    category: str
    neighborhood: str
    district: str
    discovered_at: datetime
    username: str | None  # None when the first check-in was private
    distance_m: int | None


class SuggestionsOut(BaseModel):
    people: list[SuggestedPerson]
    venues: list[DiscoveredVenue]


@router.get("/suggestions", response_model=SuggestionsOut)
def suggestions(
    lat: float | None = None,
    lon: float | None = None,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """For an empty Akış: "Önerilen kişiler" and "Yakında yeni keşfedilen mekanlar"."""
    return {"people": suggested_people(conn, user, now), "venues": discovered_venues(conn, lat, lon, now)}


class PushTokenIn(BaseModel):
    token: str
    platform: str | None = None


@router.put("/me/push-token", status_code=204)
def save_push_token(body: PushTokenIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    """The phone's Expo push address: new 🔔 items reach it while the app is closed."""
    from app.push import save_token

    if not body.token.startswith(("ExponentPushToken[", "ExpoPushToken[")):
        raise HTTPException(status_code=400, detail="Geçersiz bildirim adresi.")
    save_token(conn, user, body.token, body.platform)
    return Response(status_code=204)


@router.delete("/me/push-token", status_code=204)
def delete_push_token(body: PushTokenIn, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn)):
    from app.push import remove_token

    remove_token(conn, user, body.token)
    return Response(status_code=204)


class SummaryVenue(BaseModel):
    id: int
    name: str
    district: str | None
    visits: int


class SummaryDistrict(BaseModel):
    district: str
    visits: int


class SummaryOut(BaseModel):
    month: str  # "2026-11"
    checkins: int
    venues: int
    discoveries: int
    points: int
    previous_checkins: int  # the month before
    top_venues: list[SummaryVenue]
    top_districts: list[SummaryDistrict]
    friends: int
    rank_among_friends: int | None  # among me and my friends, by check-ins (None: no friends)
    friends_average: float | None


@router.get("/me/monthly-summary", response_model=SummaryOut)
def my_monthly_summary(
    months_back: int = 0,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """availo+ "Aylık özet" (0: this month so far, 1: last month...)."""
    from app.summary import SummaryError, monthly_summary

    try:
        return monthly_summary(conn, user, now, months_back)
    except SummaryError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None


class AwayVenue(BaseModel):
    id: int
    name: str


class WhileAwayOut(BaseModel):
    friend_checkins: int
    friend_places: list[str]  # where friends went most (up to 3)
    notifications: int  # new 🔔 items
    quiet_favorites: list[AwayVenue]  # favourites that are Sakin right now


@router.get("/me/while-away", response_model=WhileAwayOut)
def my_while_away(
    since: datetime,
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    """"Sen yokken neler oldu": shown when the app is opened after a while (`since`: when it was last open)."""
    from app.reminders import while_away

    return while_away(conn, user, since, now)


class StarterTask(BaseModel):
    key: str
    title: str
    hint: str
    done: bool


class StarterOut(BaseModel):
    tasks: list[StarterTask]
    done: int
    points_each: int
    new_points: int  # paid just now (the app says "+10 puan")


@router.get("/me/starter-tasks", response_model=StarterOut)
def my_starter_tasks(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    """İlk hafta görevleri: check-in, liste, arkadaş, fotoğraf (each pays once)."""
    from app.starter import starter_tasks

    return starter_tasks(conn, user, now)
