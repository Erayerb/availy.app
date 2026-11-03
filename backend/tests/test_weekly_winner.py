from datetime import datetime, timedelta, timezone

from app.social import last_week_winners
from tests.test_business import account, auth


def uid(client, token):
    return client.get("/v1/me", headers=auth(token)).json()["id"]


def give(conn, user_id, amount, at):
    conn.execute("INSERT INTO points (user_id, amount, reason, created_at) VALUES (%s, %s, 'checkin', %s)", (user_id, amount, at))


def test_the_first_of_last_week_gets_the_label_and_the_badge(client, conn):
    now = datetime.now(timezone.utc)
    ali, ayse, gizli = account(client, "t_ali"), account(client, "t_ayse"), account(client, "t_gizli")
    last_week = now - timedelta(days=7)
    ali_id, ayse_id, gizli_id = uid(client, ali), uid(client, ayse), uid(client, gizli)
    client.patch("/v1/me/privacy", json={"show_in_leaderboard": False}, headers=auth(gizli))
    # Whoever those requests found first in this database's own data
    conn.execute("DELETE FROM weekly_winners")
    give(conn, ali_id, 100000, last_week)
    give(conn, ayse_id, 40, last_week)
    # Points of this week and people hidden from the public ranking do not count
    give(conn, ayse_id, 500000, now)
    give(conn, gizli_id, 900000, last_week)
    assert [w["username"] for w in last_week_winners(conn, now)] == ["t_ali"]
    # On the profile (for everyone), in the ranking, and once as a badge with its points
    assert client.get("/v1/users/t_ali", headers=auth(ayse)).json()["weekly_winner"] is True
    assert client.get("/v1/users/t_ayse", headers=auth(ali)).json()["weekly_winner"] is False
    assert client.get("/v1/leaderboard?period=week&scope=everyone", headers=auth(ayse)).json()["last_week_winners"] == ["t_ali"]
    me = client.get("/v1/me", headers=auth(ali)).json()
    assert [b["id"] for b in me["new_badges"]] == ["weekly_winner"] and me["points"] == 100050
    assert client.get("/v1/me", headers=auth(ali)).json()["new_badges"] == []
