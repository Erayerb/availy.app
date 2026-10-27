-- The business's automations on the server instead of its phone (they used to work only while
-- the business had the app open):
--   * "Ölü saat bildirimi" and "Otomatik kampanya" settings
--   * weekly scheduled campaigns ("her salı 13–16 arası %20") and the days they already ran
--   * alerts written after a check-in finds the venue quiet (shown in the business's 🔔 list)
ALTER TABLE venue_profiles ADD COLUMN IF NOT EXISTS dead_hour_alerts BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE venue_profiles ADD COLUMN IF NOT EXISTS auto_campaign BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'schedule', 'auto'));

CREATE TABLE IF NOT EXISTS campaign_schedules (
    id              BIGSERIAL PRIMARY KEY,
    venue_id        BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    business_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    message         TEXT NOT NULL CHECK (length(message) BETWEEN 5 AND 140),
    discount        INTEGER CHECK (discount IS NULL OR discount BETWEEN 1 AND 90),
    radius_km       NUMERIC NOT NULL CHECK (radius_km IN (1, 2, 5)),
    days            SMALLINT[] NOT NULL,  -- 0 = Monday ... 6 = Sunday (Istanbul)
    start_hour      SMALLINT NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
    duration_hours  SMALLINT NOT NULL CHECK (duration_hours BETWEEN 1 AND 12),
    active          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_schedules_venue ON campaign_schedules (venue_id);
CREATE TABLE IF NOT EXISTS campaign_schedule_runs (
    schedule_id  BIGINT NOT NULL REFERENCES campaign_schedules(id) ON DELETE CASCADE,
    run_date     DATE NOT NULL,  -- Istanbul date: one campaign per schedule and day
    campaign_id  BIGINT REFERENCES campaigns(id) ON DELETE SET NULL,
    PRIMARY KEY (schedule_id, run_date)
);
CREATE TABLE IF NOT EXISTS business_alerts (
    id           BIGSERIAL PRIMARY KEY,
    venue_id     BIGINT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL CHECK (kind IN ('dead_hour', 'auto_campaign')),
    campaign_id  BIGINT REFERENCES campaigns(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_alerts_venue ON business_alerts (venue_id, created_at);
