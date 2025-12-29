-- =====================================================
-- User Roles Migration for Role-Based Authentication
-- =====================================================
-- This migration adds a user_roles table and triggers
-- to support role-based access control with Supabase Auth

-- =====================================================
-- 1. USER ROLES TABLE
-- =====================================================
-- Stores user roles with the user_id as primary key
-- This serves as the source of truth for roles and
-- provides an admin interface for role management

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- =====================================================
-- 2. TRIGGER: Auto-create role on user signup
-- =====================================================
-- When a new user signs up, automatically create a
-- user_roles entry with default 'user' role

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert default role for new user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Also set role in app_metadata for JWT claims
    UPDATE auth.users 
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'user')
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- =====================================================
-- 3. FUNCTION: Assign admin role
-- =====================================================
-- Use this function to promote a user to admin
-- Call from Supabase SQL Editor: SELECT assign_admin_role('user-uuid-here');

CREATE OR REPLACE FUNCTION public.assign_admin_role(target_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Get user email for confirmation message
    SELECT email INTO user_email FROM auth.users WHERE id = target_user_id;
    
    IF user_email IS NULL THEN
        RETURN 'Error: User not found with ID ' || target_user_id::TEXT;
    END IF;
    
    -- Update role in user_roles table
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin', updated_at = NOW();
    
    -- Update app_metadata for JWT claims
    UPDATE auth.users 
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
    WHERE id = target_user_id;
    
    RETURN 'Successfully assigned admin role to: ' || user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. FUNCTION: Revoke admin role (set to user)
-- =====================================================
-- Use this function to demote an admin back to user
-- Call from Supabase SQL Editor: SELECT revoke_admin_role('user-uuid-here');

CREATE OR REPLACE FUNCTION public.revoke_admin_role(target_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Get user email for confirmation message
    SELECT email INTO user_email FROM auth.users WHERE id = target_user_id;
    
    IF user_email IS NULL THEN
        RETURN 'Error: User not found with ID ' || target_user_id::TEXT;
    END IF;
    
    -- Update role in user_roles table
    UPDATE public.user_roles 
    SET role = 'user', updated_at = NOW()
    WHERE user_id = target_user_id;
    
    -- Update app_metadata for JWT claims
    UPDATE auth.users 
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'user')
    WHERE id = target_user_id;
    
    RETURN 'Successfully revoked admin role from: ' || user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. FUNCTION: Get user role
-- =====================================================
-- Utility function to get a user's current role
-- Call from Supabase SQL Editor: SELECT get_user_role('user-uuid-here');

CREATE OR REPLACE FUNCTION public.get_user_role(target_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.user_roles WHERE user_id = target_user_id;
    RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. ROW LEVEL SECURITY
-- =====================================================
-- Enable RLS and create policies for user_roles table

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own role
CREATE POLICY "Users can read their own role" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Allow admins to read all roles (need to use a subquery to check admin status)
CREATE POLICY "Admins can read all roles" ON user_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Only admins can update roles (through the functions above)
-- No direct UPDATE policy - use the functions instead

-- =====================================================
-- 7. TRIGGER: Update updated_at timestamp
-- =====================================================

CREATE TRIGGER trigger_user_roles_updated_at
    BEFORE UPDATE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- USAGE NOTES
-- =====================================================
-- 
-- 1. Run this migration in your Supabase SQL Editor
-- 
-- 2. To assign yourself as admin, find your user ID:
--    SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
-- 
-- 3. Then assign admin role:
--    SELECT assign_admin_role('your-user-id-here');
-- 
-- 4. After assigning admin role, the user must log out and log back in
--    for the JWT claims to refresh with the new role.
-- 
-- 5. In the Angular app, the role is accessed via:
--    user.app_metadata?.role || 'user'
--
