-- STEP 3: Add 10 players
-- Run this after Step 2 in Supabase SQL Editor

INSERT INTO players (name, position, category, subcategory, base_price, image_url, nationality, age, experience_years, is_sold, is_active) VALUES
('Virat Kohli', 'Top Order', 'Batsman', 'Right-handed', 2000000, NULL, 'India', 35, 18, false, true),
('Jasprit Bumrah', 'Fast Bowler', 'Bowler', 'Right-arm fast', 1800000, NULL, 'India', 30, 12, false, true),
('Hardik Pandya', 'Middle Order', 'All-Rounder', 'Right-handed batsman, Right-arm medium-fast', 1500000, NULL, 'India', 30, 10, false, true),
('MS Dhoni', 'Middle Order', 'Wicket Keeper', 'Right-handed', 1600000, NULL, 'India', 42, 20, false, true),
('AB de Villiers', 'Top Order', 'Batsman', 'Right-handed', 1700000, NULL, 'South Africa', 40, 17, false, true),
('Rashid Khan', 'Spin Bowler', 'Bowler', 'Right-arm leg-spin', 1400000, NULL, 'Afghanistan', 25, 8, false, true),
('Shubman Gill', 'Top Order', 'Batsman', 'Right-handed', 1200000, NULL, 'India', 25, 6, false, true),
('Ben Stokes', 'Middle Order', 'All-Rounder', 'Left-handed batsman, Right-arm medium-fast', 1900000, NULL, 'England', 33, 15, false, true),
('Prithvi Shaw', 'Top Order', 'Batsman', 'Right-handed', 800000, NULL, 'India', 25, 7, false, true),
('Andre Russell', 'Lower Order', 'All-Rounder', 'Right-handed batsman, Right-arm fast-medium', 1300000, NULL, 'West Indies', 36, 14, false, true);

-- Verify players were added
SELECT name, category, position, nationality, base_price FROM players ORDER BY name; 