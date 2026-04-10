-- =====================================================
-- Seed Test Data for Super Admin
-- =====================================================
-- This script safely inserts 1 Auction, 4 Teams, and 20 Players
-- under the first found 'super_admin' user.
-- Run this in your Supabase SQL Editor.

DO $$
DECLARE
  v_admin_id UUID;
  v_auction_id UUID;
  v_team_id_1 UUID;
  v_team_id_2 UUID;
  v_team_id_3 UUID;
  v_team_id_4 UUID;
  v_player_id UUID;
  v_idx INTEGER;
  
  -- Arrays of simple names to make it look a bit real
  player_names VARCHAR[] := ARRAY[
    'Virat Kohli', 'Rohit Sharma', 'MS Dhoni', 'Jasprit Bumrah', 'Hardik Pandya',
    'Ravindra Jadeja', 'KL Rahul', 'Suryakumar Yadav', 'Rishabh Pant', 'Shubman Gill',
    'Sanju Samson', 'Shreyas Iyer', 'Mohammed Shami', 'Mohammed Siraj', 'Yuzvendra Chahal',
    'Kuldeep Yadav', 'Axar Patel', 'Ravichandran Ashwin', 'Bhuvaneshwar Kumar', 'Ishan Kishan'
  ];
  player_roles VARCHAR[] := ARRAY[
    'Batsman', 'Batsman', 'Wicket-keeper', 'Bowler', 'All-rounder',
    'All-rounder', 'Batsman', 'Batsman', 'Wicket-keeper', 'Batsman',
    'Wicket-keeper', 'Batsman', 'Bowler', 'Bowler', 'Bowler',
    'Bowler', 'All-rounder', 'All-rounder', 'Bowler', 'Wicket-keeper'
  ];
  player_categories VARCHAR[] := ARRAY[
    'Top Order', 'Top Order', 'Finisher', 'Fast Bowler', 'Seam All-rounder',
    'Spin All-rounder', 'Middle Order', 'Middle Order', 'Middle Order', 'Top Order',
    'Middle Order', 'Middle Order', 'Fast Bowler', 'Fast Bowler', 'Spinner',
    'Spinner', 'Spin All-rounder', 'Spin All-rounder', 'Fast Bowler', 'Top Order'
  ];

BEGIN
  -- 1. Get the super admin ID
  SELECT user_id INTO v_admin_id FROM user_roles WHERE role = 'super_admin' LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No super_admin found. Please assign super_admin role to a user first.';
  END IF;

  -- 2. Create an Auction
  INSERT INTO auctions (owner_id, name, description, budget_per_team, max_players_per_team, min_players_per_team, status, is_public)
  VALUES (
    v_admin_id,
    'Super Admin Test Auction',
    'This is a seeded test auction for QA and testing purposes.',
    10000000, -- 10 million budget
    25,
    15,
    'draft',
    true
  ) RETURNING id INTO v_auction_id;

  -- 3. Create 4 Teams
  INSERT INTO teams (owner_id, auction_id, name, short_name, primary_color, secondary_color, budget_cap)
  VALUES (v_admin_id, v_auction_id, 'Mumbai Warriors', 'MW', '#004BA0', '#FFFFFF', 10000000) RETURNING id INTO v_team_id_1;

  INSERT INTO teams (owner_id, auction_id, name, short_name, primary_color, secondary_color, budget_cap)
  VALUES (v_admin_id, v_auction_id, 'Delhi Capitals', 'DC', '#00008B', '#FF0000', 10000000) RETURNING id INTO v_team_id_2;

  INSERT INTO teams (owner_id, auction_id, name, short_name, primary_color, secondary_color, budget_cap)
  VALUES (v_admin_id, v_auction_id, 'Chennai Super Kings', 'CSK', '#FFFF00', '#0000FF', 10000000) RETURNING id INTO v_team_id_3;

  INSERT INTO teams (owner_id, auction_id, name, short_name, primary_color, secondary_color, budget_cap)
  VALUES (v_admin_id, v_auction_id, 'Kolkata Knight Riders', 'KKR', '#3A225D', '#B3A123', 10000000) RETURNING id INTO v_team_id_4;

  -- 4. Create 20 Players in the admin's pool and add them to the auction
  FOR v_idx IN 1..20 LOOP
    -- Insert into players (global pool for the user)
    INSERT INTO players (
        owner_id, name, position, category, base_price, nationality, age, is_active, auction_status
    ) VALUES (
        v_admin_id, 
        player_names[v_idx], 
        player_roles[v_idx], 
        player_categories[v_idx], 
        (1000000 + (random() * 1000000)::INT), -- Random Base Price
        'India',
        (20 + (random() * 15)::INT), -- Random Age
        true,
        'PENDING'
    ) RETURNING id INTO v_player_id;

    -- Link player to this specific auction
    INSERT INTO auction_players (
        auction_id, player_id, base_price, status, auction_order
    ) VALUES (
        v_auction_id,
        v_player_id,
        (100000 + (random() * 1000000)::INT),
        'available',
        v_idx
    );
  END LOOP;

  RAISE NOTICE 'Test data generated successfully for Auction ID: %', v_auction_id;

END $$;
