-- The business's edits of its venue page (Ayarlar > Mekan bilgilerini düzenle), on the server
-- instead of only on the business's phone. Name, hours and purposes go to the venue itself;
-- the description and the chosen features (null: guessed from the venue type) to its profile.
ALTER TABLE venue_profiles ADD COLUMN IF NOT EXISTS description TEXT CHECK (length(description) <= 200);
ALTER TABLE venue_profiles ADD COLUMN IF NOT EXISTS amenities TEXT[];
