-- Run this in Supabase SQL Editor to add the unique constraint to an existing database:
ALTER TABLE kit_items DROP CONSTRAINT IF EXISTS unique_kit_product;
ALTER TABLE kit_items ADD CONSTRAINT unique_kit_product UNIQUE (kit_id, product_id);
