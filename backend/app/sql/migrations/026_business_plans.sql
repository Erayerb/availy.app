-- How each campaign was covered: 'saas' (aylık paket), 'founder' (kurucu mekan), 'credit' (one of the
-- verified venue's free campaigns), 'pay' (kampanya başı); counts the free ones used
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS paid_with TEXT;
