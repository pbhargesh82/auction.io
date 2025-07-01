-- STEP 2: Add 6 teams
-- Run this after Step 1 in Supabase SQL Editor

INSERT INTO teams (name, short_name, logo_url, primary_color, secondary_color, budget_cap, max_players, is_active) VALUES
('Gujarat Titans', 'GT', NULL, '#1976d2', '#424242', 10000000, 25, true),
('Punjab Kings XI', 'PBKS', NULL, '#e91e63', '#9c27b0', 10000000, 25, true),
('Mumbai Warriors', 'MW', NULL, '#2196f3', '#1565c0', 10000000, 25, true),
('Delhi Capitals', 'DC', NULL, '#ff5722', '#d84315', 10000000, 25, true),
('Kolkata Knight Riders', 'KKR', NULL, '#9c27b0', '#4a148c', 10000000, 25, true),
('Chennai Super Kings', 'CSK', NULL, '#ffeb3b', '#fbc02d', 10000000, 25, true);

-- Verify teams were added
SELECT name, short_name, primary_color, budget_cap FROM teams ORDER BY name; 