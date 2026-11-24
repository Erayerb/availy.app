"""Phone notifications while the app is closed, through Expo's push service (https://docs.expo.dev/push-notifications/).

Every 🔔 item comes from an event (a like, a check-in, a decision...). This module only delivers the new
ones to the person's phones: `deliver` sends what appeared since the last delivery, honouring the
person's "Bildirim ayarları" (kept in users.app_settings by the app). The app registers its address
(PUT /v1/me/push-token) and, once it has one, stops announcing items itself.
"""
import json
import logging
import threading
import time
import urllib.request
from datetime import datetime, timedelta, timezone

import psycopg

from app.config import settings

log = logging.getLogger("availy.push")
EXPO_URL = "https://exp.host/--/api/v2/push/send"
BATCH = 100  # Expo takes at most 100 messages per request
# Items older than this are not sent late (e.g. after the server was down)
MAX_LATE = timedelta(minutes=30)

# The app's setting that turns a kind off on the phone (Bildirim ayarları > Sosyal); others always go
SETTING_FOR_KIND = {
    "friend_request": "friendNotifications",
    "group_invite": "friendNotifications",
    "come_here": "friendNotifications",
    "together": "friendNotifications",
    "invite_joined": "friendNotifications",
    "friend_accepted": "friendAcceptedNotifications",
    "reply": "replyNotifications",
    "checkin_comment": "checkinCommentNotifications",
    "checkin_like": "checkinLikeNotifications",
    "friend_checkin": "friendCheckinNotifications",
    "friend_review": "friendCheckinNotifications",
    "watch_quiet": "watchNotifications",
    "favorite_quiet": "favoriteQuietNotifications",
    "venue_campaign": "campaignNotifications",
}

ISSUES = {
    "closed": "kapandığı",
    "hours": "saatlerinin yanlış olduğu",
    "location": "konumunun yanlış olduğu",
    "name": "adının yanlış olduğu",
    "offensive_name": "adının uygunsuz olduğu",
}


def _report(body: str | None) -> str:
    parts = (body or "").split(",")
    if len(parts) != 3:
        return "Geçen ayın availo raporu hazır."
    people, new, used = parts
    return f"Geçen ay availo ile {people} kişi geldi, {new}'i ilk kez; {used} kupon kullanıldı."


def _ended(body: str | None) -> str:
    parts = (body or "").split(",")
    if len(parts) != 3:
        return "Kampanyan bitti."
    seen, taken, used = parts
    return f"Kampanyan bitti: {seen} kişi gördü, {taken} kupon alındı, {used} kullanıldı."


def text(n: dict) -> str:
    """The same line the 🔔 list shows (mobile/src/lib/social.ts notificationText): keep the two together."""
    who = f"@{n['username']}" if n.get("username") else "Biri"
    venue, body, kind = n.get("venue_name"), n.get("body"), n["kind"]
    lines = {
        "friend_request": f"{who} ile artık arkadaşsınız." if n.get("done") else f"{who} seni arkadaş olarak eklemek istiyor.",
        "come_here": f'{who} şu an {venue} mekanında: "Buradayım, gel!"',
        "friend_accepted": f"{who} arkadaşlık isteğini kabul etti.",
        "checkin_like": f"{who} {venue} check-in'ini beğendi.",
        "checkin_comment": f'{who} {venue} check-in\'ine yorum yaptı: "{body}"',
        "loyalty": f"Check-in yaptığın {venue} sadakat programı başlattı: {body}.",
        "group_invite": f'{who} seni "{body}" grubuna davet etti.',
        "dead_hour": f"{venue} şu an sakin görünüyor. Kampanya başlat, yakındakilere ulaş!",
        "coupon_redeemed": f'Kuponun kullanıldı: "{body}"',
        "coupon_limit": f"Kampanyanın kuponları dolmak üzere ({body}).",
        "campaign_ended": _ended(body),
        "comeback": body or "Bir süredir check-in yapmadın.",
        "monthly_report": _report(body),
        "trial_ended": "Aylık paket denemen bitti. Sınırsız kampanya ve istatistikler için Aylık paket'e geç.",
        "founder_ended": "Kurucu mekan olarak 3 aylık ücretsiz Aylık paketin bitti. Devam etmek için Abonelik'e bak; rozetin kalıyor.",
        "auto_campaign": f'Ölü saat için otomatik kampanya gönderildi: "{body}"',
        "venue_campaign": f'{venue} kampanya başlattı: "{body}"',
        "reward": f'{venue} sana ödül verdi: "{body}" Kasada bu bildirimi göster.',
        "friend_checkin": f"{who} şu an {venue} mekanında. Sen de katıl!",
        "friend_review": f"{who} {venue} için yorum yazdı: {body}",
        "together": f"{who} de {venue} mekanına geldi: birlikte check-in, ikiniz de puan kazandınız.",
        "venue_approved": f"Eklediğin {venue} onaylandı, artık herkes görüyor. Puanın hesabında.",
        "invite_joined": f"{who} davetinle katıldı; artık arkadaşsınız.",
        "loyalty_reward": f"{venue} damga kartın doldu! Ödülün hazır: {body}. Kasada göster.",
        "weekly_winner": f"Tebrikler! Geçen haftanın 1.'si sensin ({body} puan).",
        "support_reply": f'Destek ekibi yanıtladı: "{body}"',
        "moment_removed": f"{venue} fotoğrafın kurallara uymadığı için kaldırıldı.",
        "watch_quiet": f"{venue} sakinleşti. Gitmek için iyi bir zaman.",
        "favorite_quiet": f"Favorin {venue} şu an sakin. Gitmek için iyi bir zaman.",
        "new_review": f"{who} {venue} için yorum yazdı: {body}",
        "sponsor_started": f'"Öne çık" yayında: {venue} ana sayfada en üstte görünüyor.',
        "sponsor_ended": '"Öne çık" süren bitti. Yeniden öne çıkmak için İşletme paneline bak.',
        "venue_issue": f"Biri {venue} mekanının {ISSUES.get(body or '', 'bilgisinin yanlış olduğu')}nu bildirdi. Bilgileri kontrol et.",
        "reply": f'{who} yorumunu yanıtladı ({venue}): "{body}"',
    }
    if kind in ("moment_report_result", "report_result"):
        what = "fotoğraf" if kind == "moment_report_result" else "yorum"
        return (
            f"Bildirdiğin {what} ({venue}) incelendi ve kaldırıldı. Teşekkürler."
            if body == "removed"
            else f"Bildirdiğin {what} ({venue}) incelendi; kurallara aykırı bulunmadı."
        )
    return lines.get(kind, "Yeni bir bildirimin var.")


def save_token(conn: psycopg.Connection, user: dict, token: str, platform: str | None) -> None:
    """A phone's address; a phone that changes hands goes to its new owner."""
    conn.execute(
        """
        INSERT INTO push_tokens (token, user_id, platform) VALUES (%s, %s, %s)
        ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, created_at = now()
        """,
        (token[:200], user["id"], (platform or "")[:20] or None),
    )


def remove_token(conn: psycopg.Connection, user: dict, token: str) -> None:
    """Signed out on that phone: nothing more goes there."""
    conn.execute("DELETE FROM push_tokens WHERE token = %s AND user_id = %s", (token, user["id"]))


def _wanted(kind: str, app_settings: dict | None) -> bool:
    key = SETTING_FOR_KIND.get(kind)
    return key is None or (app_settings or {}).get(key, True) is not False


def deliver(conn: psycopg.Connection, now: datetime, post=None) -> int:
    """Sends each person's 🔔 items that appeared since the last delivery; returns how many messages."""
    from app.reminders import remind_inactive
    from app.social import notifications

    post = post or _post
    remind_inactive(conn, now)  # 4 days without a check-in: a 🔔 item, sent below like any other
    people = conn.execute(
        """
        SELECT u.id, u.role, u.venue_id, u.app_settings, u.push_sent_at, array_agg(t.token) AS tokens
        FROM users u JOIN push_tokens t ON t.user_id = u.id
        WHERE NOT u.frozen GROUP BY u.id
        """
    ).fetchall()
    messages = []
    for person in people:
        since = max(person["push_sent_at"] or now, now - MAX_LATE)
        new = [n for n in notifications(conn, person, now) if since < n["at"] <= now and _wanted(n["kind"], person["app_settings"])]
        for n in reversed(new):  # oldest first
            data = {"venueId": n["venue_id"]} if n.get("venue_id") else {"list": True}
            messages += [{"to": token, "title": "availo", "body": text(n), "sound": "default", "data": data} for token in person["tokens"]]
        newest = max((n["at"] for n in new), default=None)
        conn.execute("UPDATE users SET push_sent_at = %s WHERE id = %s", (max(newest or now, since), person["id"]))
    for i in range(0, len(messages), BATCH):
        for token in post(messages[i:i + BATCH]):
            conn.execute("DELETE FROM push_tokens WHERE token = %s", (token,))
    return len(messages)


def _post(batch: list[dict]) -> list[str]:
    """Sends one batch; returns the addresses Expo says are gone (app removed, notifications off)."""
    request = urllib.request.Request(
        EXPO_URL,
        data=json.dumps(batch).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            tickets = json.loads(response.read()).get("data", [])
    except Exception:  # noqa: BLE001 - a failed push must not stop the next ones
        log.exception("Bildirim gönderilemedi")
        return []
    return [
        message["to"]
        for message, ticket in zip(batch, tickets)
        if ticket.get("status") == "error" and (ticket.get("details") or {}).get("error") == "DeviceNotRegistered"
    ]


def start(pool) -> threading.Event | None:
    """Delivers in the background while the server runs (off when PUSH_INTERVAL_SECONDS is 0)."""
    if settings.push_interval_seconds <= 0:
        return None
    stop = threading.Event()

    def loop():
        while not stop.wait(settings.push_interval_seconds):
            try:
                with pool.connection() as conn:
                    deliver(conn, datetime.now(timezone.utc))
            except Exception:  # noqa: BLE001
                log.exception("Bildirim teslimi başarısız")
                time.sleep(5)

    threading.Thread(target=loop, name="push", daemon=True).start()
    return stop
