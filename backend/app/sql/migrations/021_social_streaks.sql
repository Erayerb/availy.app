-- Birlikte check-in: friends at the same venue within an hour; each pair counted once (+10 points each)
CREATE TABLE IF NOT EXISTS checkin_together (
    checkin_id        BIGINT NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
    other_checkin_id  BIGINT NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
    PRIMARY KEY (checkin_id, other_checkin_id)
);

-- Seri kurtarma: a friend covers a week without a check-in, so the weekly streak goes on (once a month each)
CREATE TABLE IF NOT EXISTS streak_saves (
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start  DATE NOT NULL,      -- Monday (Istanbul) of the covered week
    saved_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, week_start)
);
CREATE INDEX IF NOT EXISTS streak_saves_saver ON streak_saves (saved_by, created_at);
