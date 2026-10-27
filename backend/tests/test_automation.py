from datetime import timedelta

from tests.test_business import account, auth, business_at
from tests.test_checkins import checkin, clock  # noqa: F401 (clock is a fixture)


def alerts(client, token):
    return [n["kind"] for n in client.get("/v1/notifications", headers=auth(token)).json() if n["kind"] in ("dead_hour", "auto_campaign")]


def test_dead_hour_alert_and_auto_campaign_after_check_ins(client, conn, clock):
    token, kafe = business_at(client, conn)
    assert client.get("/v1/business/automation", headers=auth(token)).json() == {"dead_hour_alerts": True, "auto_campaign": False}
    client.put("/v1/business/automation", json={"dead_hour_alerts": True, "auto_campaign": True}, headers=auth(token))
    # One person's "Sakin" is not enough
    checkin(client, account(client, "t_ali"), kafe, level="low")
    assert alerts(client, token) == []
    # A second one: the business is told, and the ready-made campaign goes out
    checkin(client, account(client, "t_ayse"), kafe, level="low")
    assert sorted(alerts(client, token)) == ["auto_campaign", "dead_hour"]
    mine = client.get("/v1/me/campaigns", headers=auth(token)).json()
    assert len(mine) == 1 and "boş yerimiz var" in mine[0]["message"]
    # Not again right away
    checkin(client, account(client, "t_can"), kafe, level="low")
    assert len(alerts(client, token)) == 2
    # Turned off: nothing more
    client.put("/v1/business/automation", json={"dead_hour_alerts": False, "auto_campaign": False}, headers=auth(token))
    clock.now += timedelta(hours=4)
    checkin(client, account(client, "t_deniz"), kafe, level="low")
    checkin(client, account(client, "t_ece"), kafe, level="low")
    assert len(alerts(client, token)) == 2


def test_scheduled_campaign_runs_once_in_its_window(client, conn, clock):
    token, kafe = business_at(client, conn)
    # NOON: Wednesday (2) 12:00 in Istanbul
    body = {"message": "Her çarşamba öğlen %20", "discount": 20, "radius_km": 2, "days": [2], "start_hour": 13, "duration_hours": 3}
    assert client.post("/v1/business/schedules", json={**body, "days": []}, headers=auth(token)).status_code == 400
    schedule = client.post("/v1/business/schedules", json=body, headers=auth(token)).json()
    assert client.get("/v1/campaigns").json() == []  # 12:00: not yet
    clock.now += timedelta(hours=1, minutes=30)  # 13:30
    running = client.get("/v1/campaigns").json()
    assert [c["message"] for c in running] == ["Her çarşamba öğlen %20"]
    client.get("/v1/campaigns")
    assert len(client.get("/v1/campaigns").json()) == 1  # once per day
    # Paused: not the next week
    client.patch(f"/v1/business/schedules/{schedule['id']}", json={"active": False}, headers=auth(token))
    clock.now += timedelta(days=7)
    assert client.get("/v1/campaigns").json() == []
    client.delete(f"/v1/business/schedules/{schedule['id']}", headers=auth(token))
    assert client.get("/v1/business/schedules", headers=auth(token)).json() == []
