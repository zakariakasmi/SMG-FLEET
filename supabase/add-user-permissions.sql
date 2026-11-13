-- =====================================================
-- USER PAGE PERMISSIONS
-- Add a permissions array column to the users table.
-- Each user (non-admin) can be restricted to a set of pages.
-- Run this in the Supabase SQL Editor.
-- =====================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}'::TEXT[];