from datetime import timedelta

from tests.test_checkins import NOON, clock, venue_id  # noqa: F401 (clock is a fixture)


def report(conn, venue, level, at, queue=None):
    conn.execute(
        "INSERT INTO checkins (venue_id, level, queue, created_at) VALUES (%s, %s, %s, %s)", (venue, level, queue, at)
    )


def test_usual_busy_and_quiet_hours(client, conn, clock):
    kafe = venue_id(conn, "Test Kafe A")
    assert client.get(f"/v1/venues/{kafe}/typical").json()["scope"] is None
    # NOON is 12:00 Istanbul on a Wednesday; the last three Wednesdays: busy at 18:00, quiet at 10:00
    for week in (1, 2, 3):
        day = NOON - timedelta(weeks=week)
        for _ in range(3):
            report(conn, kafe, "high", day + timedelta(hours=6), queue=True)
        for _ in range(3):
            report(conn, kafe, "low", day - timedelta(hours=2))
    typical = client.get(f"/v1/venues/{kafe}/typical").json()
    assert typical == {"scope": "today", "weekday": 2, "busy_hours": [18], "quiet_hours": [10], "usual_now": None}
    # At 18:00 on a Wednesday it is usually Kalabalık (today's own check-ins do not count)
    clock.now = NOON + timedelta(hours=6, minutes=20)
    report(conn, kafe, "low", clock.now - timedelta(minutes=5))
    assert client.get(f"/v1/venues/{kafe}/typical").json()["usual_now"] == "high"
    clock.now = NOON
    # On another weekday there is nothing for that day, so all days together
    clock.now = NOON + timedelta(days=1)
    assert client.get(f"/v1/venues/{kafe}/typical").json()["scope"] == "all"
