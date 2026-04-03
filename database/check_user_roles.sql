-- =====================================================
-- DIAGNOSTIC: Check user_roles table
-- =====================================================
-- Run this in Supabase SQL Editor to verify your role

-- 1. Check all entries in user_roles
SELECT * FROM user_roles;

-- 2. Check specifically for your user ID
SELECT 
    ur.user_id,
    ur.role,
    au.email
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE ur.user_id = '5d2ffa6c-aca6-48e8-aea9-f616316c5af2';

-- 3. Check if super_admin role exists
SELECT 
    COUNT(*) as super_admin_count 
FROM user_roles 
WHERE role = 'super_admin';

-- 4. Check the constraint on user_roles table
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'user_roles'::regclass;

-- 5. If missing, run this to add your role:
-- INSERT INTO user_roles (user_id, role) 
-- VALUES ('5d2ffa6c-aca6-48e8-aea9-f616316c5af2', 'super_admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
