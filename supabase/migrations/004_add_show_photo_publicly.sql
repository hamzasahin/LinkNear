-- Add photo privacy toggle to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_photo_publicly BOOLEAN DEFAULT false;
