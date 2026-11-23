"""İlk hafta görevleri: four first steps that teach the app (check-in, a list, a friend, a photo); each pays
TASK_POINTS once, all four bring the "Hızlı başlangıç" badge (app/checkins.py BADGES)."""
from datetime import datetime

import psycopg

TASK_POINTS = 10
TASKS = [
    ("checkin", "İlk check-in'ini yap", "Mekandayken \"Şu an burası nasıl?\" sorusunu cevapla."),
    ("list", "Bir liste oluştur", "Favorilerim'de \"＋ Yeni liste\": ör. ders çalışılacak yerler."),
    ("friend", "Bir arkadaş ekle", "Sosyal > Arkadaşlar: kullanıcı adıyla ya da rehberden."),
    ("photo", "Profil fotoğrafı ekle", "Profil ayarları'nda fotoğrafına dokun."),
]


def task_status(conn: psycopg.Connection, user_id: int) -> dict[str, bool]:
    row = conn.execute(
        """
        SELECT EXISTS (SELECT 1 FROM checkins WHERE user_id = %(id)s) AS checkin,
               EXISTS (SELECT 1 FROM venue_lists WHERE owner_id = %(id)s) AS list,
               EXISTS (SELECT 1 FROM friendships WHERE status = 'accepted' AND %(id)s IN (requester_id, addressee_id)) AS friend,
               EXISTS (SELECT 1 FROM user_photos WHERE user_id = %(id)s) AS photo
        """,
        {"id": user_id},
    ).fetchone()
    return {key: bool(row[key]) for key, _, _ in TASKS}


def starter_tasks(conn: psycopg.Connection, user: dict, now: datetime) -> dict:
    """The card: each task, done or not; a task done for the first time pays its points now (once)."""
    if user.get("role") != "personal" or user.get("is_guest"):
        return {"tasks": [], "done": 0, "points_each": TASK_POINTS, "new_points": 0}
    status = task_status(conn, user["id"])
    new_points = 0
    for key, done in status.items():
        if done:
            paid = conn.execute(
                """
                INSERT INTO points (user_id, amount, reason, task, created_at) VALUES (%s, %s, 'task', %s, %s)
                ON CONFLICT (user_id, task) WHERE task IS NOT NULL DO NOTHING RETURNING id
                """,
                (user["id"], TASK_POINTS, key, now),
            ).fetchone()
            new_points += TASK_POINTS if paid else 0
    if all(status.values()):
        from app.checkins import reward_badges

        reward_badges(conn, user["id"], now)  # "Hızlı başlangıç"
    return {
        "tasks": [{"key": key, "title": title, "hint": hint, "done": status[key]} for key, title, hint in TASKS],
        "done": sum(status.values()),
        "points_each": TASK_POINTS,
        "new_points": new_points,
    }
