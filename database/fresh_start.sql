-- =====================================================
-- Fresh Start: Clean Database & Set Super Admin
-- =====================================================
-- Run this to clean all old data and set up super_admin

-- Step 1: Clean all existing data (order matters due to foreign keys)
TRUNCATE TABLE team_players CASCADE;
TRUNCATE TABLE auction_players CASCADE;
TRUNCATE TABLE auction_history CASCADE;
TRUNCATE TABLE teams CASCADE;
TRUNCATE TABLE players CASCADE;
TRUNCATE TABLE auctions CASCADE;
TRUNCATE TABLE auction_config CASCADE;

-- Step 2: Set up super_admin user
-- First delete existing role if any
DELETE FROM user_roles WHERE user_id = '89edccc7-5241-4333-85ff-3375800f7f80';

-- Insert as super_admin
INSERT INTO user_roles (user_id, role) 
VALUES ('89edccc7-5241-4333-85ff-3375800f7f80', 'super_admin');

-- Step 3: Verify
SELECT user_id, role FROM user_roles WHERE user_id = '89edccc7-5241-4333-85ff-3375800f7f80';

-- =====================================================
-- DONE! You are now super_admin with a fresh database
-- =====================================================
