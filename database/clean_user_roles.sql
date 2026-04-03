-- =====================================================
-- Clean user_roles: Keep only pbhargesh82@aol.com as super_admin
-- =====================================================

-- Step 1: Delete ALL entries from user_roles
DELETE FROM user_roles;

-- Step 2: Insert only your account as super_admin
INSERT INTO user_roles (user_id, role) 
VALUES ('89edccc7-5241-4333-85ff-3375800f7f80', 'super_admin');

-- Step 3: Verify the cleanup
SELECT * FROM user_roles;

-- =====================================================
-- DONE: Only you will be super_admin now
-- =====================================================
