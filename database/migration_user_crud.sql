-- =====================================================
-- Enhanced Admin User Management Functions
-- =====================================================
-- Run this migration AFTER migration_admin_user_management.sql
-- Adds: invite user, delete user, ban/unban user

-- =====================================================
-- 1. Update get_all_users_with_roles to include banned status
-- =====================================================
DROP FUNCTION IF EXISTS public.get_all_users_with_roles();

CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    role VARCHAR(20),
    created_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    provider TEXT,
    email_confirmed BOOLEAN,
    role_updated_at TIMESTAMPTZ,
    is_banned BOOLEAN
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
        COALESCE(ur.updated_at, au.created_at) as role_updated_at,
        COALESCE(au.banned_until IS NOT NULL AND au.banned_until > NOW(), false) as is_banned
    FROM auth.users au
    LEFT JOIN public.user_roles ur ON au.id = ur.user_id
    ORDER BY au.created_at DESC;
END;
$$;

-- =====================================================
-- 2. FUNCTION: Invite a new user (Admin only)
-- =====================================================
-- Creates a user invitation in the database
-- Note: Supabase doesn't support creating users directly via SQL
-- This creates a placeholder in user_roles that will be filled on signup

CREATE OR REPLACE FUNCTION public.admin_invite_user(
    user_email TEXT,
    user_role VARCHAR(20) DEFAULT 'user'
)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    caller_role TEXT;
    existing_user UUID;
BEGIN
    -- Validate role value
    IF user_role NOT IN ('admin', 'user', 'viewer') THEN
        RAISE EXCEPTION 'Invalid role. Must be admin, user, or viewer.';
    END IF;
    
    -- Check if the caller is an admin
    SELECT ur.role INTO caller_role 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid();
    
    IF caller_role IS NULL OR caller_role != 'admin' THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Check if user already exists
    SELECT id INTO existing_user FROM auth.users WHERE email = user_email;
    
    IF existing_user IS NOT NULL THEN
        -- User exists, just update their role
        INSERT INTO public.user_roles (user_id, role, updated_at)
        VALUES (existing_user, user_role, NOW())
        ON CONFLICT (user_id) DO UPDATE 
        SET role = user_role, updated_at = NOW();
        
        -- Update app_metadata
        UPDATE auth.users 
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', user_role)
        WHERE id = existing_user;
        
        RETURN 'User already exists. Role updated to ' || user_role;
    END IF;
    
    -- Note: Supabase Admin API should be used to actually send invitation emails
    -- This function just prepares the role assignment
    RETURN 'Ready to invite ' || user_email || ' with role ' || user_role || '. Use Supabase dashboard to send invitation.';
END;
$$;

-- =====================================================
-- 3. FUNCTION: Ban/Unban a user (Admin only)
-- =====================================================
CREATE OR REPLACE FUNCTION public.admin_toggle_user_ban(
    target_user_id UUID,
    should_ban BOOLEAN
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
    -- Check if the caller is an admin
    SELECT ur.role INTO caller_role 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid();
    
    IF caller_role IS NULL OR caller_role != 'admin' THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Prevent self-ban
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot ban yourself.';
    END IF;
    
    -- Get target user email
    SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
    
    IF target_email IS NULL THEN
        RAISE EXCEPTION 'User not found with ID: %', target_user_id;
    END IF;
    
    -- Update banned_until in auth.users
    IF should_ban THEN
        UPDATE auth.users 
        SET banned_until = '2999-12-31'::TIMESTAMPTZ
        WHERE id = target_user_id;
        RETURN 'User ' || target_email || ' has been banned.';
    ELSE
        UPDATE auth.users 
        SET banned_until = NULL
        WHERE id = target_user_id;
        RETURN 'User ' || target_email || ' has been unbanned.';
    END IF;
END;
$$;

-- =====================================================
-- 4. FUNCTION: Delete a user (Admin only)
-- =====================================================
-- Note: This performs a hard delete from auth.users
-- Use with caution - this is irreversible!

CREATE OR REPLACE FUNCTION public.admin_delete_user(
    target_user_id UUID
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
    -- Check if the caller is an admin
    SELECT ur.role INTO caller_role 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid();
    
    IF caller_role IS NULL OR caller_role != 'admin' THEN
        RAISE EXCEPTION 'Access denied. Admin privileges required.';
    END IF;
    
    -- Prevent self-delete
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot delete yourself.';
    END IF;
    
    -- Get target user email
    SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
    
    IF target_email IS NULL THEN
        RAISE EXCEPTION 'User not found with ID: %', target_user_id;
    END IF;
    
    -- Delete from user_roles first (foreign key)
    DELETE FROM public.user_roles WHERE user_id = target_user_id;
    
    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = target_user_id;
    
    RETURN 'User ' || target_email || ' has been permanently deleted.';
END;
$$;

-- =====================================================
-- 5. Grant execute permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION public.get_all_users_with_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_invite_user(TEXT, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_ban(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- =====================================================
-- USAGE NOTES
-- =====================================================
-- 
-- 1. Run this migration after migration_admin_user_management.sql
-- 
-- 2. For inviting users, you'll also need to use Supabase Dashboard
--    or Admin API to actually send invitation emails:
--    - Go to Authentication > Users > Invite user
--    - Or use supabase.auth.admin.inviteUserByEmail()
-- 
-- 3. The ban feature uses Supabase's built-in banned_until field
--    Banned users cannot log in until unbanned
--
