-- =====================================================
-- Simple Health Check Function for Keep-Alive Pings
-- =====================================================
-- Create this function in Supabase to allow external pings

CREATE OR REPLACE FUNCTION public.health_check()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 'OK'::TEXT;
$$;

-- Allow anonymous access for health checks
GRANT EXECUTE ON FUNCTION public.health_check() TO anon;
GRANT EXECUTE ON FUNCTION public.health_check() TO authenticated;
