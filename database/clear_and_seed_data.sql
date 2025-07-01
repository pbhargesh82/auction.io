-- =====================================================
-- Clear and Seed Data Script for Auction.io
-- =====================================================
-- This script clears all existing data and creates fresh sample data
-- that matches the current form structures

-- =====================================================
-- 1. CLEAR EXISTING DATA (in proper order due to foreign keys)
-- =====================================================

-- Clear team_players first (has foreign keys to both teams and players)
DELETE FROM team_players;

-- Clear auction_history (has foreign keys)
DELETE FROM auction_history;

-- Clear player_queue (has foreign key to players)
DELETE FROM player_queue;

-- Clear auction_config (standalone table)
DELETE FROM auction_config;

-- Clear players table
DELETE FROM players;

-- Clear teams table
DELETE FROM teams;

-- Reset sequences if needed (PostgreSQL specific)
-- ALTER SEQUENCE teams_id_seq RESTART WITH 1;
-- ALTER SEQUENCE players_id_seq RESTART WITH 1;

-- =====================================================
-- 2. INSERT SAMPLE TEAMS (6 teams matching form structure)
-- =====================================================

INSERT INTO teams (name, short_name, logo_url, primary_color, secondary_color, budget_cap, max_players, is_active) VALUES
-- Team 1: Gujarat Titans
('Gujarat Titans', 'GT', NULL, '#1976d2', '#424242', 10000000, 25, true),

-- Team 2: Punjab Kings XI  
('Punjab Kings XI', 'PBKS', NULL, '#e91e63', '#9c27b0', 10000000, 25, true),

-- Team 3: Mumbai Warriors
('Mumbai Warriors', 'MW', NULL, '#2196f3', '#1565c0', 10000000, 25, true),

-- Team 4: Delhi Capitals
('Delhi Capitals', 'DC', NULL, '#ff5722', '#d84315', 10000000, 25, true),

-- Team 5: Kolkata Knight Riders
('Kolkata Knight Riders', 'KKR', NULL, '#9c27b0', '#4a148c', 10000000, 25, true),

-- Team 6: Chennai Super Kings
('Chennai Super Kings', 'CSK', NULL, '#ffeb3b', '#fbc02d', 10000000, 25, true);

-- =====================================================
-- 3. INSERT SAMPLE PLAYERS (10 players matching form structure)
-- =====================================================

INSERT INTO players (name, position, category, subcategory, base_price, image_url, nationality, age, experience_years, is_sold, is_active) VALUES
-- Player 1: Batsman
('Virat Kohli', 'Top Order', 'Batsman', 'Right-handed', 2000000, NULL, 'India', 35, 18, false, true),

-- Player 2: Bowler
('Jasprit Bumrah', 'Fast Bowler', 'Bowler', 'Right-arm fast', 1800000, NULL, 'India', 30, 12, false, true),

-- Player 3: All-Rounder
('Hardik Pandya', 'Middle Order', 'All-Rounder', 'Right-handed batsman, Right-arm medium-fast', 1500000, NULL, 'India', 30, 10, false, true),

-- Player 4: Wicket Keeper
('MS Dhoni', 'Middle Order', 'Wicket Keeper', 'Right-handed', 1600000, NULL, 'India', 42, 20, false, true),

-- Player 5: International Batsman
('AB de Villiers', 'Top Order', 'Batsman', 'Right-handed', 1700000, NULL, 'South Africa', 40, 17, false, true),

-- Player 6: International Bowler
('Rashid Khan', 'Spin Bowler', 'Bowler', 'Right-arm leg-spin', 1400000, NULL, 'Afghanistan', 25, 8, false, true),

-- Player 7: Young Talent
('Shubman Gill', 'Top Order', 'Batsman', 'Right-handed', 1200000, NULL, 'India', 25, 6, false, true),

-- Player 8: International All-Rounder
('Ben Stokes', 'Middle Order', 'All-Rounder', 'Left-handed batsman, Right-arm medium-fast', 1900000, NULL, 'England', 33, 15, false, true),

-- Player 9: Domestic Player
('Prithvi Shaw', 'Top Order', 'Batsman', 'Right-handed', 800000, NULL, 'India', 25, 7, false, true),

-- Player 10: Finisher
('Andre Russell', 'Lower Order', 'All-Rounder', 'Right-handed batsman, Right-arm fast-medium', 1300000, NULL, 'West Indies', 36, 14, false, true);

-- =====================================================
-- 4. VERIFICATION QUERIES
-- =====================================================

-- Check teams count
-- SELECT COUNT(*) as teams_count FROM teams;

-- Check players count  
-- SELECT COUNT(*) as players_count FROM players;

-- Show all teams with their details
-- SELECT name, short_name, primary_color, secondary_color, budget_cap, max_players 
-- FROM teams ORDER BY name;

-- Show all players with their details
-- SELECT name, category, position, nationality, base_price, age, experience_years 
-- FROM players ORDER BY name;

-- =====================================================
-- SCRIPT COMPLETE
-- =====================================================
-- Summary:
-- - 6 teams created (GT, PBKS, MW, DC, KKR, CSK)
-- - 10 players created (mix of Indian and international)
-- - All players are active and available for auction
-- - Budget cap set to ₹1 crore for all teams
-- - Ready for auction management testing
-- ===================================================== 