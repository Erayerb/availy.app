-- "Sil" in Kuponlarım: gone from the customer's list (the business still counts it)
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
