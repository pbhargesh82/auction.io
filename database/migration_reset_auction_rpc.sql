-- =====================================================
-- Atomic, RLS-safe auction reset
-- =====================================================
-- Run this migration in the Supabase SQL Editor after the multi-tenant migration.
-- The function is SECURITY DEFINER so all reset writes occur in one transaction,
-- but it explicitly authorizes only the auction owner or a super admin.

CREATE OR REPLACE FUNCTION public.reset_auction(p_auction_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_auction_id IS NULL THEN
        RAISE EXCEPTION 'Auction ID is required' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.auctions
        WHERE id = p_auction_id
          AND owner_id = auth.uid()
    ) AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'You are not allowed to reset this auction' USING ERRCODE = '42501';
    END IF;

    -- Remove roster assignments first; associated budget/count triggers, if any,
    -- run before the explicit zeroing below.
    DELETE FROM public.team_players
    WHERE auction_id = p_auction_id
       OR team_id IN (
            SELECT id
            FROM public.teams
            WHERE auction_id = p_auction_id
       );

    UPDATE public.teams
    SET budget_spent = 0,
        players_count = 0,
        updated_at = NOW()
    WHERE auction_id = p_auction_id;

    UPDATE public.auction_players
    SET status = 'available',
        sold_price = NULL,
        assigned_team_id = NULL,
        updated_at = NOW()
    WHERE auction_id = p_auction_id;

    DELETE FROM public.auction_history
    WHERE auction_id = p_auction_id;

    UPDATE public.auctions
    SET status = 'draft',
        current_player_id = NULL,
        current_player_position = 0,
        updated_at = NOW()
    WHERE id = p_auction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_auction(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_auction(UUID) TO authenticated;