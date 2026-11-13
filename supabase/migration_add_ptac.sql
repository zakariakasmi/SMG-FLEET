-- Migration: Add ptac column to vehicles table
-- Run this in your Supabase SQL Editor if the column doesn't exist

-- Add the ptac column if it doesn't exist
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ptac DECIMAL(10, 2);

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'vehicles'
  AND column_name = 'ptac';

-- If the column already exists, you should see one row with the column details.
-- If it didn't exist, the ALTER TABLE will add it.
