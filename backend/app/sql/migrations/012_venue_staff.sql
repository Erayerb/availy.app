-- Çalışan hesapları: a business invites its staff with a code; they keep their own personal account
-- and only work the counter (coupon and loyalty QR) of that venue, until removed.
CREATE TABLE IF NOT EXISTS staff_invites (
    code        TEXT PRIMARY KEY,  -- "7K3P9", shared by the business
    venue_id    BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS venue_staff (
    user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,  -- one workplace at a time
    venue_id    BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS venue_staff_venue ON venue_staff (venue_id);
-- Who did what at the counter (the owner sees it per person); kept after someone leaves
CREATE TABLE IF NOT EXISTS counter_actions (
    id          BIGSERIAL PRIMARY KEY,
    venue_id    BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('coupon', 'stamp', 'reward')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS counter_actions_venue ON counter_actions (venue_id, user_id);
