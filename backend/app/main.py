from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

import psycopg
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import settings
from app.db import apply_schema, get_conn, pool
from app.hours import hours_for, local_hour
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


class OccupancyOut(BaseModel):
    level: Level
    ratio: float
    updated_at: datetime


class AreaOccupancyOut(BaseModel):
    level: Level
    ratio: float


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
    occupancy: OccupancyOut
    district_occupancy: AreaOccupancyOut
    open_now: bool
    hours: str  # e.g. "08:00–23:00" or "24 saat açık"
    opens_at: str  # next opening time, shown when closed


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
    opening = hours_for(venue["category"], venue["always_busy"])
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
    opening = hours_for(venue["category"], venue["always_busy"])
    open_hours = [h for h in range(24) if opening.is_open_at_hour(h)]
    today = datetime.now(ZoneInfo(settings.dummy_timezone)).date()
    past = daily_history(provider, venue_id, venue["popularity"], venue["always_busy"], open_hours, today, days)
    return {
        "venue_id": venue_id,
        "daily": [{"date": d, "ratio": r} for d, r in past],
        "weekday": weekday_averages(past),
    }


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
    result = []
    for v in venues:
        opening = hours_for(v["category"], v["always_busy"])
        result.append(
            {
                **v,
                "occupancy": provider.get(v["id"], now, v["popularity"], v["always_busy"]),
                "district_occupancy": district_occupancy[v["district"]],
                "open_now": opening.is_open_at_hour(hour),
                "hours": opening.label(),
                "opens_at": opening.opens_at,
            }
        )
    return result
