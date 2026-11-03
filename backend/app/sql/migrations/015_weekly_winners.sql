-- "Haftanın 1.si": who finished a week first in the public ranking (ties: all of them); written once, when first needed.
CREATE TABLE IF NOT EXISTS weekly_winners (
    week_start  DATE NOT NULL,  -- Monday, Istanbul
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points      INTEGER NOT NULL,
    PRIMARY KEY (week_start, user_id)
);
CREATE INDEX IF NOT EXISTS weekly_winners_user ON weekly_winners (user_id);
