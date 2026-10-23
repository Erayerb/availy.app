from datetime import datetime, timedelta, timezone

from app.crowd import Report, age_weight, crowd_from_checkins, latest_per_person

NOW = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)


def report(user, level, minutes_ago, queue=None, seats=None, trust=1.0):
    return Report(user, level, queue, seats, NOW - timedelta(minutes=minutes_ago), trust)


def test_never_checked_in_is_unexplored():
    assert crowd_from_checkins([], None, NOW).state == "unexplored"


def test_only_old_reports_is_stale():
    old = report(1, "high", 120)
    crowd = crowd_from_checkins([old], old.created_at, NOW)
    assert crowd.state == "stale" and crowd.level is None
    assert crowd.last_report_at == old.created_at


def test_newer_reports_weigh_more():
    assert age_weight(NOW, NOW) == 1
    assert abs(age_weight(NOW - timedelta(minutes=30), NOW) - 0.65) < 1e-9
    assert abs(age_weight(NOW - timedelta(minutes=60), NOW) - 0.35) < 1e-9
    assert abs(age_weight(NOW - timedelta(minutes=45), NOW) - 0.50) < 1e-9
    assert abs(age_weight(NOW - timedelta(minutes=90), NOW) - 0.10) < 1e-9
    # Kalabalık 60 min ago vs Sakin just now: the fresh report wins
    reports = [report(1, "high", 60), report(2, "low", 0)]
    crowd = crowd_from_checkins(reports, NOW, NOW)
    assert crowd.state == "live" and crowd.level == "low"


def test_ratio_only_from_five_people():
    four = [report(i, "medium", 5 * i) for i in range(1, 5)]
    assert crowd_from_checkins(four, NOW, NOW).ratio is None
    five = four + [report(5, "medium", 25)]
    crowd = crowd_from_checkins(five, NOW, NOW)
    assert crowd.ratio == 0.55 and crowd.reporters == 5 and crowd.level == "medium"


def test_one_person_counts_once():
    # The same user reported twice; only the newest one counts
    reports = [report(1, "high", 40), report(1, "low", 5)]
    assert len(latest_per_person(reports)) == 1
    crowd = crowd_from_checkins(reports, NOW, NOW)
    assert crowd.reporters == 1 and crowd.level == "low"


def test_low_trust_counts_less():
    # A doubtful user says Kalabalık, two trusted users say Sakin
    reports = [report(1, "high", 0, trust=0.2), report(2, "low", 0), report(3, "low", 0)]
    assert crowd_from_checkins(reports, NOW, NOW).level == "low"


def test_queue_and_seats_answers():
    busy = [report(1, "high", 0, queue=True), report(2, "high", 5, queue=True), report(3, "high", 10, queue=False)]
    crowd = crowd_from_checkins(busy, NOW, NOW)
    assert crowd.level == "high" and crowd.queue is True and crowd.seats is None
    medium = [report(1, "medium", 0, seats=False), report(2, "medium", 1)]
    crowd = crowd_from_checkins(medium, NOW, NOW)
    assert crowd.level == "medium" and crowd.seats is False and crowd.queue is None


def test_window_is_ninety_minutes():
    inside = report(1, "high", 89)
    outside = report(2, "low", 91)
    crowd = crowd_from_checkins([inside, outside], inside.created_at, NOW)
    assert crowd.reporters == 1 and crowd.level == "high"


def test_venues_endpoint_includes_the_crowd(client, conn):
    from tests.conftest import KADIKOY_BBOX

    kafe = conn.execute("SELECT id FROM venues WHERE name = 'Test Kafe A'").fetchone()["id"]
    users = [
        conn.execute("INSERT INTO users (name) VALUES (%s) RETURNING id", (f"U{i}",)).fetchone()["id"] for i in range(5)
    ]
    for minutes, user in zip((5, 10, 15, 20, 25), users):
        conn.execute(
            "INSERT INTO checkins (venue_id, user_id, level, queue, created_at) VALUES (%s, %s, 'high', true, now() - %s * interval '1 minute')",
            (kafe, user, minutes),
        )
    venues = {v["name"]: v for v in client.get("/v1/venues", params={"bbox": KADIKOY_BBOX}).json()}
    crowd = venues["Test Kafe A"]["crowd"]
    assert crowd["state"] == "live" and crowd["level"] == "high"
    assert crowd["reporters"] == 5 and crowd["ratio"] == 0.98 and crowd["queue"] is True
    assert venues["Test Cowork B"]["crowd"]["state"] == "unexplored"


def test_follow_up_answers_move_the_score():
    from app.crowd import Report, report_score

    def r(level, queue=None, seats=None):
        return Report(1, level, queue, seats, NOW)

    assert report_score(r("high", queue=True)) > report_score(r("high")) > report_score(r("high", queue=False))
    assert report_score(r("medium", seats=False)) == 0.70 and report_score(r("medium", seats=True)) == 0.48
    # Orta "no seats" + Kalabalık "queue": the venue counts as Kalabalık
    full = [Report(1, "medium", None, False, NOW), Report(2, "high", True, None, NOW)]
    assert crowd_from_checkins(full, NOW, NOW).level == "high"
    # Orta "seats free" + Kalabalık "no queue": Orta
    easy = [Report(1, "medium", None, True, NOW), Report(2, "high", False, None, NOW)]
    assert crowd_from_checkins(easy, NOW, NOW).level == "medium"
