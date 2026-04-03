-- =====================================================
-- Fix: Update get_all_users_with_roles to include provider
-- =====================================================
-- The function is missing provider field needed for login method display

DROP FUNCTION IF EXISTS get_all_users_with_roles();

CREATE OR REPLACE FUNCTION get_all_users_with_roles()
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  role VARCHAR(50),
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  is_banned BOOLEAN,
  provider VARCHAR(50),
  email_confirmed BOOLEAN
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
    COALESCE(au.banned_until IS NOT NULL AND au.banned_until > NOW(), FALSE) as is_banned,
    COALESCE(au.raw_app_meta_data->>'provider', 'email')::VARCHAR(50) as provider,
    (au.email_confirmed_at IS NOT NULL) as email_confirmed
  FROM auth.users au
  LEFT JOIN user_roles ur ON au.id = ur.user_id
  ORDER BY au.created_at DESC;
END;
$$;

-- Verify
SELECT * FROM get_all_users_with_roles();
