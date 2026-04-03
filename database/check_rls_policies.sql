-- =====================================================
-- DIAGNOSE: Check RLS policies on user_roles
-- =====================================================

-- 1. Check if RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'user_roles';

-- 2. Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual::text as using_expression,
    with_check::text as with_check_expression
FROM pg_policies
WHERE tablename = 'user_roles';

-- 3. Test: Can you see your own role? (Run as your user)
-- This should return your role if RLS allows it
SELECT * FROM user_roles WHERE user_id = auth.uid();
