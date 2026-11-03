-- Stamps and used coupons were added to the points on the phone only, so the ranking and levels missed them.
-- From now on the server writes them (5 per stamp, 10 per coupon; guests half). Here: what was earned before.
INSERT INTO points (user_id, amount, reason, created_at)
SELECT m.user_id, m.total_stamps * CASE WHEN u.is_guest THEN 2 ELSE 5 END, 'stamp', m.joined_at
FROM loyalty_members m JOIN users u ON u.id = m.user_id
WHERE m.total_stamps > 0;

INSERT INTO points (user_id, amount, reason, created_at)
SELECT c.user_id, CASE WHEN u.is_guest THEN 5 ELSE 10 END, 'coupon', c.redeemed_at
FROM coupons c JOIN users u ON u.id = c.user_id
WHERE c.redeemed_at IS NOT NULL;
