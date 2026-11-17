-- Migration: Add optional ww_plate column to vehicles table
-- Run this in your Supabase SQL Editor

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS ww_plate VARCHAR(50);

NOTIFY pgrst, 'reload schema';
