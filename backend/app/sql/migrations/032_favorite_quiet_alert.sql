-- availo+ "Favorilerim sakinleşince": on for every favourite (no bell to turn on), the zil on its card in
-- Favoriler turns one off
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS quiet_alert BOOLEAN NOT NULL DEFAULT true;
