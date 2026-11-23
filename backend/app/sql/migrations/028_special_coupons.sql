-- Coupons are free; the business may make a campaign a "puanla açılan özel kupon" (points to unlock)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS points_price INTEGER NOT NULL DEFAULT 0 CHECK (points_price BETWEEN 0 AND 2000);
