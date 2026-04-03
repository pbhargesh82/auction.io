-- =====================================================
-- Fix: Update RPC functions for super_admin role
-- =====================================================
-- The old functions check for 'admin' role, need to update to 'super_admin'

-- 1. Update get_all_users_with_roles to check for super_admin
DROP FUNCTION IF EXISTS get_all_users_with_roles();

CREATE OR REPLACE FUNCTION get_all_users_with_roles()
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  role VARCHAR(50),
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  is_banned BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is super_admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Super admin privileges required.';
  END IF;

  RETURN QUERY
  SELECT 
    au.id as user_id,
    au.email::VARCHAR(255),
    COALESCE(ur.role, 'user')::VARCHAR(50),
    au.created_at,
    au.last_sign_in_at,
    COALESCE(au.banned_until IS NOT NULL AND au.banned_until > NOW(), FALSE) as is_banned
  FROM auth.users au
  LEFT JOIN user_roles ur ON au.id = ur.user_id
  ORDER BY au.created_at DESC;
END;
$$;

-- 2. Update admin_invite_user to check for super_admin
DROP FUNCTION IF EXISTS admin_invite_user(text, character varying);

CREATE OR REPLACE FUNCTION admin_invite_user(user_email TEXT, user_role VARCHAR)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is super_admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Super admin privileges required.';
  END IF;

  -- For now, just return success - actual invite logic depends on your setup
  RETURN json_build_object('success', true, 'email', user_email, 'role', user_role);
END;
$$;

-- 3. Update admin_toggle_user_ban to check for super_admin
DROP FUNCTION IF EXISTS admin_toggle_user_ban(uuid, boolean);

CREATE OR REPLACE FUNCTION admin_toggle_user_ban(target_user_id UUID, ban BOOLEAN)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is super_admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Super admin privileges required.';
  END IF;

  -- Update banned_until field
  IF ban THEN
    UPDATE auth.users SET banned_until = '9999-12-31'::TIMESTAMPTZ WHERE id = target_user_id;
  ELSE
    UPDATE auth.users SET banned_until = NULL WHERE id = target_user_id;
  END IF;

  RETURN json_build_object('success', true, 'user_id', target_user_id, 'banned', ban);
END;
$$;

-- 4. Update admin_delete_user to check for super_admin
DROP FUNCTION IF EXISTS admin_delete_user(uuid);

CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is super_admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Super admin privileges required.';
  END IF;

  -- Delete user role first
  DELETE FROM user_roles WHERE user_roles.user_id = target_user_id;
  
  -- Then delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN json_build_object('success', true, 'user_id', target_user_id);
END;
$$;

-- =====================================================
-- DONE: Run this in Supabase SQL Editor
-- =====================================================
