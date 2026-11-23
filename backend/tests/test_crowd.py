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
    assert abs(age_weight(NOW - timedelta(minutes=90), NOW) - 0.15) < 1e-9
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


def test_insiders_together_count_for_half_a_person():
    staff = [Report(i, "low", None, None, NOW - timedelta(minutes=1), insider=True) for i in range(10)]
    customer = report(99, "high", 1)
    plain = [Report(r.user_id, r.level, None, None, r.created_at) for r in staff]
    # As ordinary people ten Sakin bury one Kalabalık; as insiders they are half a person, whatever their number
    assert crowd_from_checkins([*plain, customer], NOW, NOW).level == "low"
    assert crowd_from_checkins([*staff, customer], NOW, NOW).level == "medium"
    assert crowd_from_checkins([*staff, customer, report(98, "high", 1)], NOW, NOW).level == "high"


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
    # Two people inside (one alone would count for 60 minutes only), one outside
    inside = [report(1, "high", 89), report(3, "high", 80)]
    outside = report(2, "low", 91)
    crowd = crowd_from_checkins([*inside, outside], inside[1].created_at, NOW)
    assert crowd.reporters == 2 and crowd.level == "high"


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


def test_one_report_alone_lasts_60_minutes_two_people_90():
    def report(user, minutes, level="high"):
        return Report(user, level, None, None, NOW - timedelta(minutes=minutes))

    def crowd(*reports):
        return crowd_from_checkins(list(reports), max(r.created_at for r in reports), NOW)

    assert crowd(report(1, 55)).state == "live"
    assert crowd(report(1, 65)).state == "stale"
    assert crowd(report(1, 80), report(2, 70)).level == "high"
    # A new report outweighs the old one
    assert crowd(report(1, 80), report(2, 0, "low")).level == "low"


def test_insiders_are_people_who_check_in_here_and_hardly_anywhere_else():
    from app.crowd import is_insider

    assert is_insider(5, 6)  # five days here, one elsewhere: works here
    assert not is_insider(3, 3)  # not enough days
    assert not is_insider(5, 12)  # goes to many places: a regular, counted in full


def test_staff_cannot_outvote_customers(conn):
    """Ten people who are at the café every day say Sakin; three customers say Kalabalık: Kalabalık wins,
    and the customers' trust does not drop for disagreeing with the staff."""
    from app.checkins import load_crowds, update_trust

    now = datetime(2026, 6, 10, 15, 0, tzinfo=timezone.utc)
    kafe = conn.execute("SELECT id FROM venues WHERE name = 'Test Kafe A'").fetchone()["id"]

    def user(name):
        return conn.execute(
            "INSERT INTO users (email, username, name, role) VALUES (%s, %s, %s, 'personal') RETURNING id, is_guest",
            (f"{name}@example.test", name, name),
        ).fetchone()

    def check_in(uid, level, at):
        conn.execute("INSERT INTO checkins (venue_id, user_id, level, created_at) VALUES (%s, %s, %s, %s)", (kafe, uid, level, at))

    staff = [user(f"t_garson{i}") for i in range(10)]
    customers = [user(f"t_musteri{i}") for i in range(3)]
    for s in staff:
        for day in range(1, 6):
            check_in(s["id"], "low", now - timedelta(days=day))
        check_in(s["id"], "low", now - timedelta(minutes=10))
    for c in customers:
        check_in(c["id"], "high", now - timedelta(minutes=5))
    assert load_crowds(conn, [kafe], now)[kafe].level == "high"
    # Judged only by the other customers (who agree), not by the staff
    assert update_trust(conn, dict(customers[0]), kafe, "high", now) == 1.0
    # A waiter agreeing with the other waiters earns no trust here
    assert update_trust(conn, dict(staff[0]), kafe, "low", now) is None
