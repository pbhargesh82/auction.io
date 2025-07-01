-- STEP 1: Clear all existing data
-- Run this first in Supabase SQL Editor

-- Clear team_players first (has foreign keys)
DELETE FROM team_players;

-- Clear auction_history
DELETE FROM auction_history;

-- Clear player_queue
DELETE FROM player_queue;

-- Clear auction_config
DELETE FROM auction_config;

-- Clear players table
DELETE FROM players;

-- Clear teams table  
DELETE FROM teams;

-- Check if tables are empty
SELECT 'teams' as table_name, COUNT(*) as count FROM teams
UNION ALL
SELECT 'players' as table_name, COUNT(*) as count FROM players
UNION ALL
SELECT 'team_players' as table_name, COUNT(*) as count FROM team_players; 