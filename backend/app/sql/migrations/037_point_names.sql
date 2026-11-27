-- Puanların said only "Rozet" / "Seviye atladın": points.task now names the badge or level
-- ("badge:night_owl", "level:local"). Older rows get theirs from when the badge / level was recorded.
WITH p AS (
    SELECT id, user_id, created_at, row_number() OVER (PARTITION BY user_id, created_at ORDER BY id) AS n
    FROM points WHERE reason = 'badge' AND task IS NULL
), b AS (
    SELECT user_id, badge_id, earned_at, row_number() OVER (PARTITION BY user_id, earned_at ORDER BY badge_id) AS n
    FROM user_badges
)
UPDATE points SET task = 'badge:' || b.badge_id
FROM p JOIN b ON b.user_id = p.user_id AND b.earned_at = p.created_at AND b.n = p.n
WHERE points.id = p.id
  AND NOT EXISTS (SELECT 1 FROM points q WHERE q.user_id = p.user_id AND q.task = 'badge:' || b.badge_id);

WITH p AS (
    SELECT id, user_id, created_at, row_number() OVER (PARTITION BY user_id, created_at ORDER BY id) AS n
    FROM points WHERE reason = 'level' AND task IS NULL
), l AS (
    SELECT user_id, level_id, created_at, row_number() OVER (PARTITION BY user_id, created_at ORDER BY level_id) AS n
    FROM level_rewards
)
UPDATE points SET task = 'level:' || l.level_id
FROM p JOIN l ON l.user_id = p.user_id AND l.created_at = p.created_at AND l.n = p.n
WHERE points.id = p.id
  AND NOT EXISTS (SELECT 1 FROM points q WHERE q.user_id = p.user_id AND q.task = 'level:' || l.level_id);
