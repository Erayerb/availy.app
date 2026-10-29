-- Badges earn points once: which ones a person has already been given (and celebrated)
CREATE TABLE IF NOT EXISTS user_badges (
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id   TEXT NOT NULL,
    earned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, badge_id)
);
-- Set the first time a person's badges are written down: what they had earned before is recorded
-- without points (no burst of old rewards when this arrives)
ALTER TABLE users ADD COLUMN IF NOT EXISTS badges_synced_at TIMESTAMPTZ;
-- New accounts start written down, so their first badges do earn points
ALTER TABLE users ALTER COLUMN badges_synced_at SET DEFAULT now();
