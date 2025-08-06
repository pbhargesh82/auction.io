-- =====================================================
-- Migration: Remove Auction Status Management
-- =====================================================
-- This migration removes the auction status management system
-- since we're simplifying to manual player selection only

-- Remove status-related columns from auction_config
ALTER TABLE auction_config 
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS started_at,
DROP COLUMN IF EXISTS completed_at;

-- Remove the status check constraint
ALTER TABLE auction_config 
DROP CONSTRAINT IF EXISTS auction_config_status_check;

-- Remove the unique index on status (only one active auction)
DROP INDEX IF EXISTS idx_auction_config_active;

-- Update the auction_progress view to remove status references
DROP VIEW IF EXISTS auction_progress;

CREATE VIEW auction_progress AS
SELECT 
    ac.id as auction_id,
    ac.name as auction_name,
    COUNT(p.id) as total_players,
    COUNT(CASE WHEN p.auction_status = 'SOLD' THEN 1 END) as sold_players,
    COUNT(CASE WHEN p.auction_status = 'PENDING' THEN 1 END) as pending_players,
    COUNT(CASE WHEN p.auction_status = 'UNSOLD' THEN 1 END) as unsold_players,
    ROUND(
        (COUNT(CASE WHEN p.auction_status = 'SOLD' THEN 1 END)::DECIMAL / 
         NULLIF(COUNT(p.id), 0)) * 100, 2
    ) as completion_percentage
FROM auction_config ac
LEFT JOIN players p ON p.is_active = true
GROUP BY ac.id, ac.name; 