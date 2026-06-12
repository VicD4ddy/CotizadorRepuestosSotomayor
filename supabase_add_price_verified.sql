-- Add price_verified column to kits table
ALTER TABLE kits ADD COLUMN IF NOT EXISTS price_verified BOOLEAN DEFAULT false;
ALTER TABLE kits ADD COLUMN IF NOT EXISTS price_verified_at TIMESTAMPTZ;
