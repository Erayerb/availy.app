"""v2 loyalty: a venue's stamp card ("5 kahveye 1 bedava") or paid membership, on the server.

Customers see active programs and join the ones they want; the business stamps a member with the
customer code from their QR and marks a full card's reward used. Customers who checked in at a
venue get a notification when it starts a program (app/social.py).
"""
import secrets
from datetime import datetime

import psycopg


class LoyaltyError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


PROGRAM_SELECT = """
    SELECT p.venue_id, v.name AS venue_name, p.kind, p.stamps_required, p.reward, p.price, p.perk, p.active
    FROM loyalty_programs p JOIN venues v ON v.id = p.venue_id
"""


def customer_code(conn: psycopg.Connection, user_id: int) -> str:
    """The user's code for the counter; made on first use."""
    row = conn.execute("SELECT customer_code FROM users WHERE id = %s", (user_id,)).fetchone()
    if row and row["customer_code"]:
        return row["customer_code"]
    for _ in range(20):
        code = f"M-{secrets.randbelow(1_000_000):06d}"
        try:
            with conn.transaction():
                conn.execute("UPDATE users SET customer_code = %s WHERE id = %s", (code, user_id))
            return code
        except psycopg.errors.UniqueViolation:
            continue
    raise LoyaltyError("Müşteri kodu oluşturulamadı.", 503)


def programs_for(conn: psycopg.Connection, me: dict | None) -> list[dict]:
    """Active programs, each with my card / membership if I joined."""
    rows = conn.execute(PROGRAM_SELECT + " WHERE p.active ORDER BY v.name").fetchall()
    mine = {}
    if me:
        mine = {
            r["venue_id"]: r
            for r in conn.execute(
                "SELECT venue_id, stamps, rewards, total_stamps, joined_at FROM loyalty_members WHERE user_id = %s",
                (me["id"],),
            ).fetchall()
        }
    return [{**r, "member": mine.get(r["venue_id"])} for r in rows]


def join(conn: psycopg.Connection, user: dict, venue_id: int, now: datetime) -> None:
    if user.get("role") == "business":
        raise LoyaltyError("İşletme hesapları sadakat programlarına katılamaz.", 403)
    if user.get("is_guest"):
        raise LoyaltyError("Sadakat programına katılmak için kayıt ol.", 403)
    if not conn.execute("SELECT 1 FROM loyalty_programs WHERE venue_id = %s AND active", (venue_id,)).fetchone():
        raise LoyaltyError("Bu mekanın aktif sadakat programı yok.", 404)
    conn.execute(
        "INSERT INTO loyalty_members (venue_id, user_id, joined_at) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
        (venue_id, user["id"], now),
    )


def leave(conn: psycopg.Connection, user: dict, venue_id: int) -> None:
    conn.execute("DELETE FROM loyalty_members WHERE venue_id = %s AND user_id = %s", (venue_id, user["id"]))


def _business_venue(user: dict) -> int:
    if user.get("role") != "business" or not user.get("venue_id"):
        raise LoyaltyError("Sadakat programını yalnızca mekanı seçili işletme hesabı yönetir.", 403)
    return user["venue_id"]


def my_program(conn: psycopg.Connection, user: dict) -> dict:
    venue_id = _business_venue(user)
    program = conn.execute(PROGRAM_SELECT + " WHERE p.venue_id = %s", (venue_id,)).fetchone()
    members = conn.execute(
        "SELECT count(*)::int AS n, COALESCE(sum(total_stamps), 0)::int AS stamps FROM loyalty_members WHERE venue_id = %s",
        (venue_id,),
    ).fetchone()
    return {"program": program, "members": members["n"], "stamps_given": members["stamps"]}


def save_program(
    conn: psycopg.Connection,
    user: dict,
    kind: str,
    stamps_required: int,
    reward: str,
    price: int,
    perk: str,
    active: bool,
    now: datetime,
) -> dict:
    venue_id = _business_venue(user)
    reward, perk = " ".join(reward.split())[:80], " ".join(perk.split())[:80]
    if kind == "stamps":
        if not 2 <= stamps_required <= 20:
            raise LoyaltyError("Damga sayısı 2 ile 20 arasında olmalı.")
        if len(reward) < 3:
            raise LoyaltyError("Ödülü yaz (ör. 1 kahve bedava).")
    elif kind == "membership":
        if price <= 0:
            raise LoyaltyError("Aylık ücreti yaz.")
        if len(perk) < 3:
            raise LoyaltyError("Üyelere ne sunduğunu yaz (ör. her kahvede %15 indirim).")
    else:
        raise LoyaltyError("Program türünü seç.")
    conn.execute(
        """
        INSERT INTO loyalty_programs (venue_id, kind, stamps_required, reward, price, perk, active, activated_at)
        VALUES (%(v)s, %(kind)s, %(stamps)s, %(reward)s, %(price)s, %(perk)s, %(active)s, %(now)s)
        ON CONFLICT (venue_id) DO UPDATE SET
            kind = EXCLUDED.kind, stamps_required = EXCLUDED.stamps_required, reward = EXCLUDED.reward,
            price = EXCLUDED.price, perk = EXCLUDED.perk, active = EXCLUDED.active,
            -- switched on again: the customers who checked in hear about it again
            activated_at = CASE WHEN EXCLUDED.active AND NOT loyalty_programs.active THEN EXCLUDED.activated_at
                                ELSE loyalty_programs.activated_at END
        """,
        {
            "v": venue_id,
            "kind": kind,
            "stamps": stamps_required if kind == "stamps" else 5,
            "reward": reward,
            "price": max(price, 0),
            "perk": perk,
            "active": active,
            "now": now,
        },
    )
    return my_program(conn, user)


def remove_program(conn: psycopg.Connection, user: dict) -> None:
    conn.execute("DELETE FROM loyalty_programs WHERE venue_id = %s", (_business_venue(user),))


def _member_by_code(conn: psycopg.Connection, venue_id: int, code: str) -> dict:
    customer = conn.execute(
        "SELECT id FROM users WHERE customer_code = %s", ("".join(code.split()).upper(),)
    ).fetchone()
    if customer is None:
        raise LoyaltyError("Bu müşteri kodu bulunamadı.", 404)
    member = conn.execute(
        "SELECT stamps, rewards FROM loyalty_members WHERE venue_id = %s AND user_id = %s FOR UPDATE",
        (venue_id, customer["id"]),
    ).fetchone()
    if member is None:
        raise LoyaltyError("Bu müşteri programına katılmamış: Kampanyalar → Sadakat'ta mekanında \"Katıl\"a bassın.", 409)
    return {**member, "user_id": customer["id"]}


def give_stamp(conn: psycopg.Connection, user: dict, code: str) -> str:
    venue_id = _business_venue(user)
    program = conn.execute(
        "SELECT kind, stamps_required, reward FROM loyalty_programs WHERE venue_id = %s AND active", (venue_id,)
    ).fetchone()
    if program is None or program["kind"] != "stamps":
        raise LoyaltyError("Önce aktif bir damga kartı programı oluştur.", 409)
    member = _member_by_code(conn, venue_id, code)
    stamps = member["stamps"] + 1
    full = stamps >= program["stamps_required"]
    conn.execute(
        """
        UPDATE loyalty_members SET stamps = %s, rewards = rewards + %s, total_stamps = total_stamps + 1
        WHERE venue_id = %s AND user_id = %s
        """,
        (0 if full else stamps, 1 if full else 0, venue_id, member["user_id"]),
    )
    if full:
        return f"Kart doldu! Müşteri ödül kazandı: {program['reward']}."
    return f"Damga verildi ({stamps}/{program['stamps_required']})."


def use_reward(conn: psycopg.Connection, user: dict, code: str) -> str:
    venue_id = _business_venue(user)
    member = _member_by_code(conn, venue_id, code)
    if member["rewards"] <= 0:
        raise LoyaltyError("Kullanılacak ödül yok.", 409)
    conn.execute(
        "UPDATE loyalty_members SET rewards = rewards - 1 WHERE venue_id = %s AND user_id = %s",
        (venue_id, member["user_id"]),
    )
    return "Ödül kullanıldı."
