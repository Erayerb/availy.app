-- "Buranın müdavimi": one per venue, the same for everyone (worked out after each check-in)
CREATE TABLE IF NOT EXISTS venue_regulars (
    venue_id   BIGINT PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    since      TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS venue_regulars_user ON venue_regulars (user_id);

-- Someone took my place as a venue's regular: "Mado'daki müdavimliğini @ayse aldı"
CREATE TABLE IF NOT EXISTS regular_changes (
    id          BIGSERIAL PRIMARY KEY,
    venue_id    BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    lost_by     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    taken_by    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS regular_changes_lost ON regular_changes (lost_by, created_at);

-- Levels reached (each once): +30 points and the level's gift. Kâşif: one standing reward without points
-- (welcome_used_at once it is used)
CREATE TABLE IF NOT EXISTS level_rewards (
    user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level_id         TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL,
    welcome_used_at  TIMESTAMPTZ,
    PRIMARY KEY (user_id, level_id)
);

-- availo+ given for a while (Mahalleli: a week, Semt elçisi: a month); NULL: bought, or none
ALTER TABLE users ADD COLUMN IF NOT EXISTS plus_until TIMESTAMPTZ;
