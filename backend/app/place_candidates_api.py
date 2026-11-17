from datetime import datetime

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth_api import current_user
from app.checkins_api import get_clock
from app.db import get_conn
from app.place_candidates import CandidateError, candidate_to_venue, search_candidates

router = APIRouter(prefix="/v1")


class CandidateOut(BaseModel):
    id: str
    name: str
    category: str
    lat: float
    lon: float
    distance_m: int | None = None


@router.get("/places/candidates", response_model=list[CandidateOut])
def candidates(
    q: str = Query(..., max_length=60),
    lat: float | None = None,
    lon: float | None = None,
    conn: psycopg.Connection = Depends(get_conn),
):
    """"Haritada yok mu?": places from open data that match the search and are not on the map yet."""
    return search_candidates(conn, q, lat, lon)


class AddedOut(BaseModel):
    id: int  # the venue
    created: bool  # False: it was on the map already


@router.post("/places/candidates/{candidate_id}/venue", response_model=AddedOut)
def add(candidate_id: str, user: dict = Depends(current_user), conn: psycopg.Connection = Depends(get_conn), now: datetime = Depends(get_clock)):
    """"Ekle ve check-in yap": the candidate becomes a venue (or the venue it already is)."""
    try:
        return candidate_to_venue(conn, user, candidate_id, now)
    except CandidateError as e:
        raise HTTPException(status_code=e.status, detail=e.message) from None
