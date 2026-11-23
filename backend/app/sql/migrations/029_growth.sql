-- İlk hafta görevleri: each pays once (points.task names it)
ALTER TABLE points ADD COLUMN IF NOT EXISTS task TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS points_task_once ON points (user_id, task) WHERE task IS NOT NULL;

-- Kalıcı ödül ("200 puan = %10"): a campaign that stays on the venue page; a person may take it once a week,
-- so one person may have several coupons of it (claim_coupon keeps one per person for the others)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS standing BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_campaign_id_user_id_key;
CREATE INDEX IF NOT EXISTS coupons_campaign_user ON coupons (campaign_id, user_id);

-- Aylık paket: 15 days free, once per venue; kurucu mekan: the free monthly plan ends after 3 months
ALTER TABLE venue_profiles ADD COLUMN IF NOT EXISTS trial_until TIMESTAMPTZ;
ALTER TABLE venue_profiles ADD COLUMN IF NOT EXISTS founder_until TIMESTAMPTZ;
UPDATE venue_profiles SET founder_until = now() + interval '90 days' WHERE founder AND founder_until IS NULL;

-- Tanıtım sayfası: "Kurucu mekan ol" applications
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS founder BOOLEAN NOT NULL DEFAULT false;
