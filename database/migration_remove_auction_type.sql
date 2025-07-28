-- Migration to remove auction_type column from auction_config table
-- This migration removes the auction_type field since timer functionality will be per-player, not per-auction

-- Remove the auction_type column from auction_config table
ALTER TABLE auction_config DROP COLUMN IF EXISTS auction_type;

-- Add a comment to document this migration
COMMENT ON TABLE auction_config IS 'Auction configuration table - timer functionality will be per-player, not per-auction'; 