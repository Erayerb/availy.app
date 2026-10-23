"""v2 endpoints: leaderboard (Sosyal > Sıralama) and notifications (🔔)."""
from datetime import datetime
from typing import Literal

import psycopg
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth_api import current_user
from app.checkins_api import get_clock
from app.db import get_conn
from app.social import leaderboard, notifications
from app.suggestions import discovered_venues, suggested_people

router = APIRouter(prefix="/v1")


class RankRow(BaseModel):
    rank: int
    username: str | None
    points: int
    me: bool


class MyRank(BaseModel):
    rank: int
    points: int


class LeaderboardOut(BaseModel):
    rows: list[RankRow]
    me: MyRank | None


class NotificationOut(BaseModel):
    kind: Literal["friend_request", "friend_accepted", "reply", "reward", "loyalty"]
    at: datetime
    username: str | None
    venue_id: int | None
    venue_name: str | None
    body: str | None


@router.get("/leaderboard", response_model=LeaderboardOut)
def ranking(
    period: Literal["week", "all"] = "week",
    scope: Literal["friends", "everyone"] = "friends",
    user: dict = Depends(current_user),
    conn: psycopg.Connection = Depends(get_conn),
    now: datetime = Depends(get_clock),
):
    return leaderboard(conn, user, period, scope, now)


@router.get("/notifications", response_model=list[NotificationOut])
def my_notifications(user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    return notifications(conn, user, now)


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
