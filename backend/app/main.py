from contextlib import asynccontextmanager
from typing import Literal
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

import psycopg
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.auth_api import router as auth_router
from app.campaigns_api import router as campaigns_router
from app.checkins_api import router as checkins_router
from app.friends_api import router as friends_router
from app.reviews_api import router as reviews_router
from app.social_api import router as social_router
from app.safety_api import router as safety_router
from app.business_api import router as business_router
from app.venues_api import router as venues_router
from app.checkins import load_crowds, load_discoveries, load_trends
from app.config import settings
from app.db import apply_schema, get_conn, pool
from app.hours import local_hour, venue_hours
from app.venue_profiles import load_profiles
from app.occupancy import (
    Level,
    OccupancyProvider,
    average_occupancy,
    daily_history,
    get_occupancy_provider,
    hourly_profile,
    weekday_averages,
)
from app.venues import (
    find_venue_profile,
    find_venues_by_district,
    find_venues_in_bbox,
    list_districts,
    parse_bbox,
    parse_ids,
    parse_tags,
    search_venues,
)

TAGS_DESCRIPTION = "Comma-separated: socializing,coworking,entertainment,quiet,food"


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    with pool.connection() as conn:
        apply_schema(conn)
    yield
    pool.close()


app = FastAPI(title="Availy API", lifespan=lifespan)
# Sign-in uses the Authorization header, not cookies, so credentials stay off
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(auth_router)
app.include_router(checkins_router)
app.include_router(friends_router)
app.include_router(reviews_router)
app.include_router(social_router)
app.include_router(safety_router)
app.include_router(business_router)
app.include_router(campaigns_router)
app.include_router(venues_router)


class OccupancyOut(BaseModel):
    level: Level
    ratio: float
    updated_at: datetime


class AreaOccupancyOut(BaseModel):
    level: Level
    ratio: float


class CrowdOut(BaseModel):
    """v2: occupancy from recent check-ins."""

    state: Literal["live", "stale", "unexplored"]
    level: Level | None
    ratio: float | None  # only with at least 5 people in the last 90 minutes
    reporters: int
    last_report_at: datetime | None
    queue: bool | None
    seats: bool | None
    yesterday_level: Level | None = None  # stale only: the level at this time yesterday


class DiscoveryOut(BaseModel):
    """v2: "Burayı X keşfetti" (first check-in, shown for 30 days)."""

    name: str | None  # None when the first check-in was private
    username: str | None = None  # shown as "@eray"; None when private (or a guest)
    at: datetime


class Venue(BaseModel):
    id: int
    name: str
    category: str
    capacity: int
    lat: float
    lon: float
    neighborhood: str
    district: str
    tags: list[str]
    # v1 fake occupancy; kept until the app switches to `crowd` (v2 stage 6)
    occupancy: OccupancyOut
    district_occupancy: AreaOccupancyOut
    crowd: CrowdOut
    discovery: DiscoveryOut | None
    trend: int = 0  # different people who checked in during the last 24 hours ("Trendler")
    open_now: bool
    hours: str  # e.g. "08:00–23:00" or "24 saat açık"
    opens_at: str  # next opening time, shown when closed
    address: str | None = None  # written by the venue's business
    pending: bool = False  # added by a user, waiting for approval ("⏳ Onay bekliyor")
    # The business's profile: cover photo (GET /v1/venues/{id}/photo), links, "✓ Doğrulanmış işletme"
    photo_at: datetime | None = None
    instagram: str | None = None
    phone: str | None = None
    verified: bool = False


@app.get("/health")
def health(conn: psycopg.Connection = Depends(get_conn)):
    try:
        conn.execute("SELECT 1")
    except psycopg.Error:
        return JSONResponse(status_code=503, content={"status": "error", "db": "down"})
    return {"status": "ok", "db": "ok"}


@app.get("/v1/venues", response_model=list[Venue])
def list_venues(
    bbox: str = Query(..., description="minLon,minLat,maxLon,maxLat"),
    tags: str | None = Query(None, description=TAGS_DESCRIPTION),
    conn: psycopg.Connection = Depends(get_conn),
    provider: OccupancyProvider = Depends(get_occupancy_provider),
):
    try:
        parsed = parse_bbox(bbox)
        parsed_tags = parse_tags(tags)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    venues = find_venues_in_bbox(conn, parsed, settings.max_venues_per_request, parsed_tags)
    return with_occupancy(conn, provider, venues)


@app.get("/v1/venues/search", response_model=list[Venue])
def search(
    q: str = Query("", max_length=50, description="Part of the venue name"),
    district: str | None = Query(None),
    tags: str | None = Query(None, description=TAGS_DESCRIPTION),
    ids: str | None = Query(None, description="Comma-separated venue ids, e.g. favorites"),
    conn: psycopg.Connection = Depends(get_conn),
    provider: OccupancyProvider = Depends(get_occupancy_provider),
):
    try:
        parsed_tags = parse_tags(tags)
        parsed_ids = parse_ids(ids, settings.max_venues_per_request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    venues = search_venues(
        conn, q.strip(), district or None, parsed_tags, settings.max_venues_per_request, parsed_ids
    )
    return with_occupancy(conn, provider, venues)


class HourOut(BaseModel):
    hour: int
    level: Level
    ratio: float
    open: bool


class HourlyOut(BaseModel):
    venue_id: int
    date: date
    hours: list[HourOut]


@app.get("/v1/venues/{venue_id}/hourly", response_model=HourlyOut)
def hourly(
    venue_id: int,
    conn: psycopg.Connection = Depends(get_conn),
    provider: OccupancyProvider = Depends(get_occupancy_provider),
):
    """Today's occupancy per local hour for one venue (business stats panel)."""
    venue = find_venue_profile(conn, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="venue not found")
    today = datetime.now(ZoneInfo(settings.dummy_timezone)).date()
    profile = hourly_profile(provider, venue_id, venue["popularity"], today, venue["always_busy"])
    opening = venue_hours(venue)
    return {
        "venue_id": venue_id,
        "date": today,
        "hours": [
            {"hour": h, "level": o.level, "ratio": o.ratio, "open": opening.is_open_at_hour(h)}
            for h, o in enumerate(profile)
        ],
    }


class DayOut(BaseModel):
    date: date
    ratio: float


class HistoryOut(BaseModel):
    venue_id: int
    daily: list[DayOut]
    weekday: list[float]  # Monday first


@app.get("/v1/venues/{venue_id}/history", response_model=HistoryOut)
def history(
    venue_id: int,
    days: int = Query(30, ge=7, le=90),
    conn: psycopg.Connection = Depends(get_conn),
    provider: OccupancyProvider = Depends(get_occupancy_provider),
):
    """Average occupancy during opening hours per day (business weekly / monthly statistics)."""
    venue = find_venue_profile(conn, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="venue not found")
    opening = venue_hours(venue)
    open_hours = [h for h in range(24) if opening.is_open_at_hour(h)]
    today = datetime.now(ZoneInfo(settings.dummy_timezone)).date()
    past = daily_history(provider, venue_id, venue["popularity"], venue["always_busy"], open_hours, today, days)
    return {
        "venue_id": venue_id,
        "daily": [{"date": d, "ratio": r} for d, r in past],
        "weekday": weekday_averages(past),
    }


class ForecastPoint(BaseModel):
    at: datetime
    ratio: float
    open: bool


class ForecastOut(BaseModel):
    venue_id: int
    points: list[ForecastPoint]


@app.get("/v1/venues/{venue_id}/forecast", response_model=ForecastOut)
def forecast(
    venue_id: int,
    hours: int = Query(12, ge=1, le=24),
    conn: psycopg.Connection = Depends(get_conn),
    provider: OccupancyProvider = Depends(get_occupancy_provider),
):
    """Expected occupancy for each upcoming time step, so the app can schedule
    "it emptied" / dead-hour notifications that fire while it is closed."""
    venue = find_venue_profile(conn, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="venue not found")
    opening = venue_hours(venue)
    step = settings.dummy_bucket_seconds
    first = (int(datetime.now(timezone.utc).timestamp()) // step + 1) * step
    points = []
    for i in range(hours * 3600 // step):
        at = datetime.fromtimestamp(first + i * step, tz=timezone.utc)
        o = provider.get(venue_id, at, venue["popularity"], venue["always_busy"])
        points.append({"at": at, "ratio": o.ratio, "open": opening.is_open_at_hour(local_hour(at))})
    return {"venue_id": venue_id, "points": points}


@app.get("/v1/districts", response_model=list[str])
def districts(conn: psycopg.Connection = Depends(get_conn)):
    return list_districts(conn)


def with_occupancy(conn: psycopg.Connection, provider: OccupancyProvider, venues: list[dict]) -> list[dict]:
    """Attach each venue's occupancy and its district's average occupancy."""
    now = datetime.now(timezone.utc)

    # District busyness covers every venue in the district, not only the visible ones
    members = find_venues_by_district(conn, sorted({v["district"] for v in venues}))
    district_occupancy = {
        district: average_occupancy([provider.get(m["id"], now, m["popularity"], m["always_busy"]).ratio for m in group])
        for district, group in members.items()
    }

    hour = local_hour(now)
    crowds = load_crowds(conn, [v["id"] for v in venues], now)
    discoveries = load_discoveries(conn, [v["id"] for v in venues], now)
    trends = load_trends(conn, [v["id"] for v in venues], now)
    profiles = load_profiles(conn, [v["id"] for v in venues])
    result = []
    for v in venues:
        opening = venue_hours(v)
        result.append(
            {
                **v,
                **profiles.get(v["id"], {}),
                "occupancy": provider.get(v["id"], now, v["popularity"], v["always_busy"]),
                "district_occupancy": district_occupancy[v["district"]],
                "crowd": crowds[v["id"]],
                "discovery": discoveries.get(v["id"]),
                "trend": trends.get(v["id"], 0),
                "open_now": opening.is_open_at_hour(hour),
                "hours": opening.label(),
                "opens_at": opening.opens_at,
            }
        )
    return result
