-- ============================================================================
-- DEPRECATED – DO NOT RUN IN PRODUCTION
-- ============================================================================
-- This script was used for one-time ID sync on 2026-01-19.
-- Running this again WILL DELETE all admin_users!
-- ============================================================================

-- EMERGENCY FIX: Sync admin_users with correct auth.users IDs
-- Run this in Supabase Dashboard > SQL Editor

-- The problem: admin_users.id does NOT match auth.users.id
-- This causes password reset to fail with "User not found"

-- Step 1: Delete all existing admin_users (they have wrong IDs)
DELETE FROM admin_users;

-- Step 2: Insert with correct auth IDs
-- These IDs come from auth.users (run this in SQL Editor after checking auth.users)

-- Admin user (auth.users ID: e49bb8a6-b812-4171-b60b-b96ca96ee600)
INSERT INTO admin_users (id, email, name, role, "isActive", "passwordHash", "createdAt", "updatedAt")
VALUES (
  'e49bb8a6-b812-4171-b60b-b96ca96ee600',
  'admin@unbreak-one.com',
  'Admin',
  'ADMIN',
  true,
  'SUPABASE_AUTH',
  NOW(),
  NOW()
);

-- Nina (auth.users ID: 63d1445f-cacf-4ea1-91ff-752408f631cc)
INSERT INTO admin_users (id, email, name, role, "isActive", "passwordHash", "createdAt", "updatedAt")
VALUES (
  '63d1445f-cacf-4ea1-91ff-752408f631cc',
  'nina@unbreak-one.com',
  'Nina',
  'SUPPORT',
  true,
  'SUPABASE_AUTH',
  NOW(),
  NOW()
);

-- Step 3: Verify
SELECT id, email, role FROM admin_users;

-- Expected output:
-- e49bb8a6-b812-4171-b60b-b96ca96ee600 | admin@unbreak-one.com | ADMIN
-- 63d1445f-cacf-4ea1-91ff-752408f631cc | nina@unbreak-one.com  | SUPPORT
