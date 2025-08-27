-- =====================================================
-- Migration: Add sell player back to pool function
-- =====================================================
-- This function handles the process of selling a player back to the auction pool
-- It refunds the purchase price to the team and marks the player as unsold

-- Function to sell player back to auction pool
CREATE OR REPLACE FUNCTION sell_player_back_to_pool(
    p_team_player_id UUID,
    p_team_id UUID,
    p_player_id UUID,
    p_purchase_price DECIMAL(10,2)
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    team_record RECORD;
    player_record RECORD;
BEGIN
    -- Start transaction
    BEGIN
        -- Get team information
        SELECT * INTO team_record FROM teams WHERE id = p_team_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Team not found';
        END IF;

        -- Get player information
        SELECT * INTO player_record FROM players WHERE id = p_player_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Player not found';
        END IF;

        -- Remove the team-player assignment
        DELETE FROM team_players WHERE id = p_team_player_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Team player assignment not found';
        END IF;

        -- Refund the purchase price to the team
        UPDATE teams 
        SET budget_spent = budget_spent - p_purchase_price,
            players_count = players_count - 1,
            updated_at = NOW()
        WHERE id = p_team_id;

        -- Mark player as unsold
        UPDATE players 
        SET is_sold = false, updated_at = NOW()
        WHERE id = p_player_id;

        -- Create auction history record for the sell-back
        INSERT INTO auction_history (
            player_id,
            winning_team_id,
            final_price,
            auction_date,
            sold_at,
            notes,
            status
        ) VALUES (
            p_player_id,
            p_team_id,
            p_purchase_price,
            CURRENT_DATE,
            NOW(),
            'Player sold back to auction pool - refund processed',
            'WITHDRAWN'
        );

        -- Return success result
        result := json_build_object(
            'success', true,
            'message', 'Player successfully sold back to auction pool',
            'refunded_amount', p_purchase_price,
            'team_id', p_team_id,
            'player_id', p_player_id
        );

        RETURN result;

    EXCEPTION
        WHEN OTHERS THEN
            -- Rollback transaction
            RAISE EXCEPTION 'Error selling player back to pool: %', SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION sell_player_back_to_pool(UUID, UUID, UUID, DECIMAL) TO authenticated;

-- =====================================================
-- Migration completed successfully!
-- =====================================================
