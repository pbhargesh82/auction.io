-- =====================================================
-- FIX: RLS Policy Infinite Recursion
-- =====================================================
-- The super_admin check policies were causing recursion by querying user_roles
-- which itself has RLS policies. We need to use a security definer function instead.

-- Step 1: Create a security definer function to check super_admin status
-- This bypasses RLS and prevents recursion
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Drop existing problematic policies
DROP POLICY IF EXISTS "Super admin full access to auctions" ON auctions;
DROP POLICY IF EXISTS "Super admin full access to players" ON players;
DROP POLICY IF EXISTS "Super admin full access to teams" ON teams;
DROP POLICY IF EXISTS "Super admin full access to auction_players" ON auction_players;
DROP POLICY IF EXISTS "Super admin full access to team_players" ON team_players;
DROP POLICY IF EXISTS "Super admin full access to auction_history" ON auction_history;

-- Step 3: Recreate policies using the security definer function
CREATE POLICY "Super admin full access to auctions" ON auctions
    FOR ALL USING (is_super_admin());

CREATE POLICY "Super admin full access to players" ON players
    FOR ALL USING (is_super_admin());

CREATE POLICY "Super admin full access to teams" ON teams
    FOR ALL USING (is_super_admin());

CREATE POLICY "Super admin full access to auction_players" ON auction_players
    FOR ALL USING (is_super_admin());

CREATE POLICY "Super admin full access to team_players" ON team_players
    FOR ALL USING (is_super_admin());

CREATE POLICY "Super admin full access to auction_history" ON auction_history
    FOR ALL USING (is_super_admin());

-- Step 4: Also fix user_roles table policies if needed
-- Drop any existing recursive policies
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
DROP POLICY IF EXISTS "Super admin can manage all roles" ON user_roles;

-- Simple policies that don't cause recursion
CREATE POLICY "Users can view own role" ON user_roles
    FOR SELECT USING (user_id = auth.uid());

-- For super_admin management of roles, we use the security definer function
CREATE POLICY "Super admin can manage all roles" ON user_roles
    FOR ALL USING (is_super_admin());

-- =====================================================
-- DONE: Run this in Supabase SQL Editor
-- =====================================================
