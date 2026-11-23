-- 🔔 for events whose rows do not stay (a removed photo, a decision): one line kept for the person
CREATE TABLE IF NOT EXISTS user_notices (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    venue_id    BIGINT REFERENCES venues(id) ON DELETE CASCADE,
    body        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_notices_user ON user_notices (user_id, created_at);

-- "Destek talebine yanıt geldi": the answer is written in the app, not only by e-mail
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS reply TEXT;
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- "Sadakat kartın doldu": when the last card filled up
ALTER TABLE loyalty_members ADD COLUMN IF NOT EXISTS reward_at TIMESTAMPTZ;
