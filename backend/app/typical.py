"""v2 "Genelde 18:00'de kalabalık": a venue's usual busy and quiet hours from past weeks' check-ins.

Each check-in's score (app/crowd.py report_score) is averaged per weekday and hour over the last
8 weeks. Today's weekday is used when it has enough check-ins, otherwise all days together.
`usual_now` is the usual level at this hour, for "Şu an normalden daha sakin": only earlier days
count, so today's check-ins (the live crowd) are not compared with themselves.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import psycopg

from app.config import settings
from app.crowd import Report, report_score
from app.occupancy import classify

ISTANBUL = ZoneInfo("Europe/Istanbul")
WEEKS = 8
MIN_REPORTS = 3  # check-ins an hour needs before it says anything


def typical_hours(conn: psycopg.Connection, venue_id: int, now: datetime) -> dict:
    rows = conn.execute(
        """
        SELECT user_id, level, queue, seats, created_at FROM checkins
        WHERE venue_id = %s AND NOT is_demo AND created_at > %s AND created_at <= %s
        """,
        (venue_id, now - timedelta(weeks=WEEKS), now),
    ).fetchall()
    local_now = now.astimezone(ISTANBUL)
    today = local_now.weekday()
    by_day: dict[int, list[float]] = {}
    by_hour: dict[int, list[float]] = {}
    # This hour on earlier days: today's weekday, and all days
    before_today = {"today": [], "all": []}
    for r in rows:
        local = r["created_at"].astimezone(ISTANBUL)
        score = report_score(Report(r["user_id"], r["level"], r["queue"], r["seats"], r["created_at"]))
        by_hour.setdefault(local.hour, []).append(score)
        if local.weekday() == today:
            by_day.setdefault(local.hour, []).append(score)
        if local.hour == local_now.hour and local.date() < local_now.date():
            before_today["all"].append(score)
            if local.weekday() == today:
                before_today["today"].append(score)
    scope, hours = "today", {h: s for h, s in by_day.items() if len(s) >= MIN_REPORTS}
    if not hours:
        scope, hours = "all", {h: s for h, s in by_hour.items() if len(s) >= MIN_REPORTS}
    average = {h: sum(s) / len(s) for h, s in hours.items()}
    usual = before_today["today"] if len(before_today["today"]) >= MIN_REPORTS else before_today["all"]
    return {
        "scope": scope if average else None,
        "weekday": today,  # Monday = 0
        "busy_hours": sorted(h for h, a in average.items() if a > settings.occupancy_medium_max),
        "quiet_hours": sorted(h for h, a in average.items() if a < settings.occupancy_low_max),
        "usual_now": classify(sum(usual) / len(usual)).value if len(usual) >= MIN_REPORTS else None,
    }
