-- Migration: Add auction_status column to players table
-- This replaces the need for a separate player_queue table

-- Add auction_status column to players table
ALTER TABLE players 
ADD COLUMN auction_status VARCHAR(20) DEFAULT 'INACTIVE' 
CHECK (auction_status IN ('PENDING', 'CURRENT', 'SOLD', 'UNSOLD', 'SKIPPED', 'INACTIVE'));

-- Create index for better performance
CREATE INDEX idx_players_auction_status ON players(auction_status);

-- Update existing players to have PENDING status if they are active
UPDATE players 
SET auction_status = 'PENDING' 
WHERE is_active = true AND auction_status = 'INACTIVE';

-- Drop the player_queue table since we're using the players table directly
-- (This is optional - you can keep it for backward compatibility)
-- DROP TABLE IF EXISTS player_queue CASCADE; 