-- =====================================================
-- RLS-safe sell player back to pool
-- =====================================================
-- Run this in the Supabase SQL Editor after the multi-tenant migration.
-- The original function used the caller's table permissions while inserting
-- auction_history, which fails because that table requires owner_id = auth.uid().

CREATE OR REPLACE FUNCTION public.sell_player_back_to_pool(
    p_team_player_id UUID,
    p_team_id UUID,
    p_player_id UUID,
    p_purchase_price DECIMAL(10,2)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_team_player public.team_players%ROWTYPE;
    v_auction_id UUID;
    v_owner_id UUID;
    v_purchase_price DECIMAL(10,2);
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'You must be signed in to return a player to the pool'
            USING ERRCODE = '42501';
    END IF;

    -- Lock and validate the roster assignment. The client-supplied team, player,
    -- and price must never determine which record is changed or refunded.
    SELECT tp.*
    INTO v_team_player
    FROM public.team_players AS tp
    WHERE tp.id = p_team_player_id
      AND tp.team_id = p_team_id
      AND tp.player_id = p_player_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team player assignment not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT COALESCE(v_team_player.auction_id, t.auction_id), a.owner_id
    INTO v_auction_id, v_owner_id
    FROM public.teams AS t
    JOIN public.auctions AS a ON a.id = COALESCE(v_team_player.auction_id, t.auction_id)
    WHERE t.id = v_team_player.team_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The team player assignment is not associated with an auction'
            USING ERRCODE = 'P0002';
    END IF;

    IF v_owner_id <> auth.uid() AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'You are not allowed to return this player to the pool'
            USING ERRCODE = '42501';
    END IF;

    v_purchase_price := v_team_player.purchase_price;

    DELETE FROM public.team_players
    WHERE id = v_team_player.id;

    UPDATE public.teams
    SET budget_spent = GREATEST(COALESCE(budget_spent, 0) - v_purchase_price, 0),
        players_count = GREATEST(COALESCE(players_count, 0) - 1, 0),
        updated_at = NOW()
    WHERE id = v_team_player.team_id;

    UPDATE public.auction_players
    SET status = 'available',
        sold_price = NULL,
        assigned_team_id = NULL,
        updated_at = NOW()
    WHERE auction_id = v_auction_id
      AND player_id = v_team_player.player_id;

    UPDATE public.players
    SET is_sold = false,
        updated_at = NOW()
    WHERE id = v_team_player.player_id;

    -- Keep a ledger entry for the return. owner_id is required by the
    -- multi-tenant auction_history RLS policy, and SECURITY DEFINER makes this
    -- write atomic with the roster and budget changes above.
    INSERT INTO public.auction_history (
        player_id,
        winning_team_id,
        final_price,
        auction_date,
        sold_at,
        notes,
        status,
        auction_id,
        owner_id
    ) VALUES (
        v_team_player.player_id,
        v_team_player.team_id,
        v_purchase_price,
        CURRENT_DATE,
        NOW(),
        'Player returned to auction pool - refund processed',
        'WITHDRAWN',
        v_auction_id,
        v_owner_id
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Player successfully returned to the auction pool',
        'refunded_amount', v_purchase_price,
        'team_id', v_team_player.team_id,
        'player_id', v_team_player.player_id,
        'auction_id', v_auction_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.sell_player_back_to_pool(UUID, UUID, UUID, DECIMAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sell_player_back_to_pool(UUID, UUID, UUID, DECIMAL) TO authenticated;
