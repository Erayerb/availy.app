-- "Bilgi yanlış mı?": users report a venue that closed or has wrong hours, location or name.
-- The same thing reported by 3 people puts the venue on the admin's "Kontrol edilecek" list.
ALTER TABLE venues ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;  -- closed for good: off the map
CREATE TABLE IF NOT EXISTS venue_issues (
    id          BIGSERIAL PRIMARY KEY,
    venue_id    BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('closed', 'hours', 'location', 'name')),
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);
-- One open report per person, venue and kind
CREATE UNIQUE INDEX IF NOT EXISTS venue_issues_open ON venue_issues (venue_id, user_id, kind) WHERE resolved_at IS NULL;
