-- Migration to remove player_queue table and all its references
-- This migration removes the player_queue table since we're using the players table directly

-- Drop the player_queue table and all its dependencies
DROP TABLE IF EXISTS player_queue CASCADE;

-- Remove the player_queue index
DROP INDEX IF EXISTS idx_player_queue_status_order;

-- Remove player_queue RLS policies (they will be dropped automatically with the table)
-- No need to explicitly drop policies as they're dropped with the table

-- Update the get_next_player function to work with players table directly
CREATE OR REPLACE FUNCTION get_next_player()
RETURNS TABLE (
    player_id UUID,
    player_name TEXT,
    position TEXT,
    category TEXT,
    base_price DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as player_id,
        p.name as player_name,
        p.position,
        p.category,
        p.base_price
    FROM players p
    WHERE p.auction_status = 'PENDING' 
    AND p.is_active = true
    ORDER BY p.name
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Update the auction_progress view to work without player_queue
CREATE OR REPLACE VIEW auction_progress AS
SELECT 
    ac.id as auction_id,
    ac.name as auction_name,
    ac.status as auction_status,
    COUNT(p.id) as total_players,
    COUNT(CASE WHEN p.auction_status = 'SOLD' THEN 1 END) as sold_players,
    COUNT(CASE WHEN p.auction_status = 'PENDING' THEN 1 END) as remaining_players,
    COUNT(CASE WHEN p.auction_status = 'CURRENT' THEN 1 END) as current_players,
    ROUND(
        (COUNT(CASE WHEN p.auction_status = 'SOLD' THEN 1 END)::DECIMAL / 
         NULLIF(COUNT(p.id), 0)::DECIMAL) * 100, 2
    ) as progress_percentage
FROM auction_config ac
LEFT JOIN players p ON p.is_active = true
GROUP BY ac.id, ac.name, ac.status;

-- Update the player_category_stats view
CREATE OR REPLACE VIEW player_category_stats AS
SELECT 
    p.category,
    p.position,
    COUNT(*) as total_players,
    COUNT(CASE WHEN p.auction_status = 'SOLD' THEN 1 END) as sold_players,
    COUNT(CASE WHEN p.auction_status = 'PENDING' THEN 1 END) as available_players,
    COUNT(CASE WHEN p.auction_status = 'CURRENT' THEN 1 END) as current_players,
    COUNT(CASE WHEN p.auction_status = 'UNSOLD' THEN 1 END) as unsold_players,
    ROUND(AVG(p.base_price), 2) as avg_base_price,
    MIN(p.base_price) as min_base_price,
    MAX(p.base_price) as max_base_price
FROM players p
WHERE p.is_active = true
GROUP BY p.category, p.position
ORDER BY p.category, p.position;

-- Add a comment to document this migration
COMMENT ON TABLE players IS 'Players table now includes auction_status field to replace player_queue functionality'; 