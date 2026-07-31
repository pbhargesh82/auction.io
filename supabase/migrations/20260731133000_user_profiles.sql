-- =====================================================
-- User Profiles Migration
-- =====================================================
-- Creates user_profiles table, RLS, signup trigger, and backfills existing users.

-- =====================================================
-- 1. USER PROFILES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    full_name TEXT,
    bio TEXT,
    phone_number TEXT,
    avatar_url TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'email' CHECK (auth_provider IN ('email', 'google')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT user_profiles_bio_length CHECK (bio IS NULL OR char_length(bio) <= 500),
    CONSTRAINT user_profiles_display_name_length CHECK (display_name IS NULL OR char_length(display_name) <= 50),
    CONSTRAINT user_profiles_full_name_length CHECK (full_name IS NULL OR char_length(full_name) <= 100)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- =====================================================
-- 2. UPDATED_AT TRIGGER
-- =====================================================

DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_provider TEXT;
    v_display_name TEXT;
    v_full_name TEXT;
    v_avatar_url TEXT;
BEGIN
    v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
    IF v_provider NOT IN ('email', 'google') THEN
        v_provider := 'email';
    END IF;

    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name'
    );
    v_display_name := COALESCE(
        v_full_name,
        split_part(NEW.email, '@', 1)
    );
    v_avatar_url := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture'
    );

    INSERT INTO public.user_profiles (
        user_id,
        email,
        display_name,
        full_name,
        avatar_url,
        auth_provider
    ) VALUES (
        NEW.id,
        NEW.email,
        v_display_name,
        v_full_name,
        v_avatar_url,
        v_provider
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admins can read all profiles" ON public.user_profiles;
CREATE POLICY "Super admins can read all profiles" ON public.user_profiles
    FOR SELECT USING (is_super_admin());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- 5. BACKFILL EXISTING USERS
-- =====================================================

INSERT INTO public.user_profiles (
    user_id,
    email,
    display_name,
    full_name,
    avatar_url,
    auth_provider
)
SELECT
    u.id,
    u.email,
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1)
    ),
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name'
    ),
    COALESCE(
        u.raw_user_meta_data->>'avatar_url',
        u.raw_user_meta_data->>'picture'
    ),
    CASE
        WHEN COALESCE(u.raw_app_meta_data->>'provider', 'email') = 'google' THEN 'google'
        ELSE 'email'
    END
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.user_id = u.id
);

-- =====================================================
-- USAGE
-- =====================================================
-- Run this migration in Supabase SQL Editor after is_super_admin() exists
-- (see database/fix_rls_recursion.sql).
