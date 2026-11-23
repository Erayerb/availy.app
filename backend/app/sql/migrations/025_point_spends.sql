-- Points spent (coupons): kept apart from `points`, so spending never lowers a level or the weekly ranking
CREATE TABLE IF NOT EXISTS point_spends (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount       INTEGER NOT NULL CHECK (amount > 0),
    coupon_code  TEXT REFERENCES coupons(code) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS point_spends_user ON point_spends (user_id);
