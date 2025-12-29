-- =====================================================
-- Admin User Management Functions for User Management Page
-- =====================================================
-- These functions allow admins to view and manage all users
-- Run this migration after migration_user_roles.sql

-- =====================================================
-- 1. FUNCTION: Get all users with their roles (Admin only)
-- =====================================================
-- This function returns all users with their roles and metadata
-- It can only be called by admin users (enforced by RLS)

CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    role VARCHAR(20),
    created_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    provider TEXT,
    email_confirmed BOOLEAN,
    role_updated_at TIMESTAMPTZ
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    caller_role TEXT;
BEGIN
    -- Check if the caller is an admin
    SELECT ur.role INTO caller_role 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid();
    
    IF caller_role IS NULL OR caller_role != 'admin' THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    RETURN QUERY
    SELECT 
        au.id as user_id,
        au.email::TEXT,
        COALESCE(ur.role, 'user'::VARCHAR(20)) as role,
        au.created_at,
        au.last_sign_in_at,
        COALESCE(
            au.raw_app_meta_data->>'provider',
            (au.raw_app_meta_data->'providers'->>0),
            'email'
        )::TEXT as provider,
        (au.email_confirmed_at IS NOT NULL) as email_confirmed,
        COALESCE(ur.updated_at, au.created_at) as role_updated_at
    FROM auth.users au
    LEFT JOIN public.user_roles ur ON au.id = ur.user_id
    ORDER BY au.created_at DESC;
END;
$$;

-- =====================================================
-- 2. FUNCTION: Update user role (Admin only)
-- =====================================================
-- Allows admins to change any user's role
-- Also updates the JWT app_metadata for the role

CREATE OR REPLACE FUNCTION public.admin_update_user_role(
    target_user_id UUID,
    new_role VARCHAR(20)
)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    caller_role TEXT;
    target_email TEXT;
BEGIN
    -- Validate role value
    IF new_role NOT IN ('admin', 'user', 'viewer') THEN
        RAISE EXCEPTION 'Invalid role. Must be admin, user, or viewer.';
    END IF;
    
    -- Check if the caller is an admin
    SELECT ur.role INTO caller_role 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid();
    
    IF caller_role IS NULL OR caller_role != 'admin' THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Get target user email for confirmation
    SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
    
    IF target_email IS NULL THEN
        RAISE EXCEPTION 'User not found with ID: %', target_user_id;
    END IF;
    
    -- Prevent self-demotion (optional safety check)
    IF target_user_id = auth.uid() AND new_role != 'admin' THEN
        RAISE EXCEPTION 'Cannot remove your own admin privileges.';
    END IF;
    
    -- Update or insert role in user_roles table
    INSERT INTO public.user_roles (user_id, role, updated_at)
    VALUES (target_user_id, new_role, NOW())
    ON CONFLICT (user_id) DO UPDATE 
    SET role = new_role, updated_at = NOW();
    
    -- Update app_metadata for JWT claims
    UPDATE auth.users 
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
    WHERE id = target_user_id;
    
    RETURN 'Successfully updated role to ' || new_role || ' for user: ' || target_email;
END;
$$;

-- =====================================================
-- 3. Grant execute permissions
-- =====================================================
-- Only authenticated users can call these functions
-- But the functions internally check for admin role

GRANT EXECUTE ON FUNCTION public.get_all_users_with_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, VARCHAR) TO authenticated;

-- =====================================================
-- USAGE NOTES
-- =====================================================
-- 
-- 1. Run this migration in your Supabase SQL Editor
-- 
-- 2. These functions are called from the Angular UsersService:
--    - get_all_users_with_roles(): Lists all users for admin
--    - admin_update_user_role(user_id, role): Changes a user's role
-- 
-- 3. Both functions enforce admin-only access internally
-- 
-- 4. Role changes take effect immediately in the database
--    but users must log out and back in for JWT claims to update
--
