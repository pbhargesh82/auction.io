-- =====================================================
-- Auction.io Database Reset Script for Supabase PostgreSQL
-- =====================================================
-- This script completely resets the database and recreates all tables,
-- triggers, functions, and views with the current schema

-- WARNING: This will delete all existing data!
-- Only run this in development or when you want to start fresh

-- =====================================================
-- 1. DROP ALL EXISTING OBJECTS
-- =====================================================

-- Drop all views first
DROP VIEW IF EXISTS team_stats CASCADE;
DROP VIEW IF EXISTS auction_progress CASCADE;
DROP VIEW IF EXISTS player_category_stats CASCADE;

-- Drop all triggers
DROP TRIGGER IF EXISTS trigger_update_team_budget ON team_players;
DROP TRIGGER IF EXISTS trigger_teams_updated_at ON teams;
DROP TRIGGER IF EXISTS trigger_players_updated_at ON players;
DROP TRIGGER IF EXISTS trigger_auction_config_updated_at ON auction_config;

-- Drop all functions
DROP FUNCTION IF EXISTS update_team_budget() CASCADE;
DROP FUNCTION IF EXISTS get_next_player() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop all tables (in reverse dependency order)
DROP TABLE IF EXISTS auction_history CASCADE;
DROP TABLE IF EXISTS team_players CASCADE;
DROP TABLE IF EXISTS auction_config CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Drop any remaining indexes
DROP INDEX IF EXISTS idx_teams_is_active CASCADE;
DROP INDEX IF EXISTS idx_teams_name_search CASCADE;
DROP INDEX IF EXISTS idx_players_category_position CASCADE;
DROP INDEX IF EXISTS idx_players_is_sold CASCADE;
DROP INDEX IF EXISTS idx_players_name_search CASCADE;
DROP INDEX IF EXISTS idx_players_auction_status CASCADE;
DROP INDEX IF EXISTS idx_team_players_team_id CASCADE;
DROP INDEX IF EXISTS idx_team_players_purchased_at CASCADE;
DROP INDEX IF EXISTS idx_auction_history_auction_date CASCADE;
DROP INDEX IF EXISTS idx_auction_config_active CASCADE;

-- =====================================================
-- 2. ENABLE EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 3. CREATE TABLES
-- =====================================================

-- Teams table
CREATE TABLE teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    short_name VARCHAR(10) UNIQUE,
    logo_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#1976d2',
    secondary_color VARCHAR(7) DEFAULT '#424242',
    budget_cap DECIMAL(12,2) NOT NULL DEFAULT 10000000,
    budget_spent DECIMAL(12,2) DEFAULT 0,
    budget_remaining DECIMAL(12,2) GENERATED ALWAYS AS (budget_cap - budget_spent) STORED,
    players_count INTEGER DEFAULT 0,
    max_players INTEGER DEFAULT 25,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT teams_budget_spent_check CHECK (budget_spent >= 0),
    CONSTRAINT teams_players_count_check CHECK (players_count >= 0),
    CONSTRAINT teams_max_players_check CHECK (max_players > 0)
);

-- Players table
CREATE TABLE players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    position VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    base_price DECIMAL(10,2) NOT NULL DEFAULT 100000,
    image_url TEXT,
    nationality VARCHAR(50),
    age INTEGER,
    experience_years INTEGER,
    stats JSONB, -- Store player statistics as JSON
    auction_status VARCHAR(20) DEFAULT 'PENDING' CHECK (auction_status IN ('PENDING', 'CURRENT', 'SOLD', 'UNSOLD', 'SKIPPED', 'INACTIVE')),
    is_sold BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT players_base_price_check CHECK (base_price > 0),
    CONSTRAINT players_age_check CHECK (age > 0 AND age < 100),
    CONSTRAINT players_experience_check CHECK (experience_years >= 0)
);

-- Auction config table
CREATE TABLE auction_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    budget_cap DECIMAL(12,2) NOT NULL DEFAULT 10000000,
    max_players_per_team INTEGER NOT NULL DEFAULT 25,
    min_players_per_team INTEGER DEFAULT 15,
    current_player_id UUID REFERENCES players(id),
    current_player_position INTEGER DEFAULT 0,
    total_players INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Team players table
CREATE TABLE team_players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    purchase_price DECIMAL(10,2) NOT NULL,
    purchased_at TIMESTAMP DEFAULT NOW(),
    position_in_team VARCHAR(50), -- Position assigned in team
    is_captain BOOLEAN DEFAULT FALSE,
    is_vice_captain BOOLEAN DEFAULT FALSE,
    
    -- Ensure player is only in one team
    UNIQUE(player_id),
    
    -- Constraints
    CONSTRAINT team_players_price_check CHECK (purchase_price > 0)
);

-- Auction history table
CREATE TABLE auction_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID REFERENCES players(id),
    winning_team_id UUID REFERENCES teams(id),
    final_price DECIMAL(10,2),
    auction_date DATE DEFAULT CURRENT_DATE,
    sold_at TIMESTAMP DEFAULT NOW(),
    auction_round INTEGER,
    bidding_duration INTERVAL, -- How long the bidding lasted
    notes TEXT,
    status VARCHAR(20) DEFAULT 'SOLD' CHECK (status IN ('SOLD', 'UNSOLD', 'WITHDRAWN'))
);

-- =====================================================
-- 4. CREATE INDEXES
-- =====================================================

-- Teams indexes
CREATE INDEX idx_teams_is_active ON teams(is_active);
CREATE INDEX idx_teams_name_search ON teams USING gin(to_tsvector('english', name));

-- Players indexes
CREATE INDEX idx_players_category_position ON players(category, position);
CREATE INDEX idx_players_is_sold ON players(is_sold);
CREATE INDEX idx_players_auction_status ON players(auction_status);
CREATE INDEX idx_players_name_search ON players USING gin(to_tsvector('english', name));

-- Team players indexes
CREATE INDEX idx_team_players_team_id ON team_players(team_id);
CREATE INDEX idx_team_players_purchased_at ON team_players(purchased_at);

-- Auction history indexes
CREATE INDEX idx_auction_history_auction_date ON auction_history(auction_date);

-- Unique constraint removed - no longer needed without status management

-- =====================================================
-- 5. CREATE FUNCTIONS
-- =====================================================

-- Function to update team budget when player is purchased
CREATE OR REPLACE FUNCTION update_team_budget()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Update team budget and player count
        UPDATE teams 
        SET budget_spent = budget_spent + NEW.purchase_price,
            players_count = players_count + 1,
            updated_at = NOW()
        WHERE id = NEW.team_id;
        
        -- Mark player as sold and update auction status
        UPDATE players 
        SET is_sold = true, 
            auction_status = 'SOLD',
            updated_at = NOW()
        WHERE id = NEW.player_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Reverse the operation
        UPDATE teams 
        SET budget_spent = budget_spent - OLD.purchase_price,
            players_count = players_count - 1,
            updated_at = NOW()
        WHERE id = OLD.team_id;
        
        -- Mark player as unsold
        UPDATE players 
        SET is_sold = false, 
            auction_status = 'PENDING',
            updated_at = NOW()
        WHERE id = OLD.player_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to get next player from players table
CREATE OR REPLACE FUNCTION get_next_player()
RETURNS UUID AS $$
DECLARE
    next_player_id UUID;
BEGIN
    SELECT id INTO next_player_id
    FROM players
    WHERE auction_status = 'PENDING' AND is_active = true
    ORDER BY name
    LIMIT 1;
    
    IF next_player_id IS NOT NULL THEN
        -- Update current player status
        UPDATE players 
        SET auction_status = 'CURRENT'
        WHERE id = next_player_id;
        
        -- Update auction config
        UPDATE auction_config 
        SET current_player_id = next_player_id,
            current_player_position = (
                SELECT COUNT(*) + 1
                FROM players 
                WHERE auction_status IN ('SOLD', 'UNSOLD', 'SKIPPED')
            );
    END IF;
    
    RETURN next_player_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. CREATE TRIGGERS
-- =====================================================

-- Trigger to update team budget when player is purchased/removed
CREATE TRIGGER trigger_update_team_budget
    AFTER INSERT OR DELETE ON team_players
    FOR EACH ROW EXECUTE FUNCTION update_team_budget();

-- Triggers to update updated_at timestamps
CREATE TRIGGER trigger_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_players_updated_at
    BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_auction_config_updated_at
    BEFORE UPDATE ON auction_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. CREATE VIEWS
-- =====================================================

-- Team statistics view
CREATE VIEW team_stats AS
SELECT 
    t.id,
    t.name,
    t.short_name,
    t.budget_cap,
    t.budget_spent,
    t.budget_remaining,
    t.players_count,
    COUNT(tp.id) as actual_players_count,
    COALESCE(AVG(tp.purchase_price), 0) as avg_purchase_price,
    COALESCE(MAX(tp.purchase_price), 0) as highest_purchase,
    COALESCE(MIN(tp.purchase_price), 0) as lowest_purchase
FROM teams t
LEFT JOIN team_players tp ON t.id = tp.team_id
GROUP BY t.id, t.name, t.short_name, t.budget_cap, t.budget_spent, t.budget_remaining, t.players_count;

-- Auction progress view
CREATE VIEW auction_progress AS
SELECT 
    ac.id as auction_id,
    ac.name as auction_name,
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
GROUP BY ac.id, ac.name;

-- Player category statistics view
CREATE VIEW player_category_stats AS
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

-- =====================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admin) full access
CREATE POLICY "Enable all operations for authenticated users" ON teams
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON players
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON auction_config
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON team_players
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON auction_history
    FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- 9. SAMPLE DATA
-- =====================================================

-- Sample teams
INSERT INTO teams (name, short_name, primary_color, budget_cap) VALUES
('Mumbai Warriors', 'MW', '#0066cc', 10000000),
('Delhi Capitals', 'DC', '#cc0000', 10000000),
('Chennai Super Kings', 'CSK', '#ffcc00', 10000000),
('Kolkata Knight Riders', 'KKR', '#6600cc', 10000000);

-- Sample players
INSERT INTO players (name, position, category, base_price, nationality, age, auction_status) VALUES
('Virat Kohli', 'Batsman', 'Top Order', 2000000, 'India', 35, 'PENDING'),
('Rohit Sharma', 'Batsman', 'Top Order', 2000000, 'India', 36, 'PENDING'),
('Jasprit Bumrah', 'Bowler', 'Fast Bowler', 1800000, 'India', 30, 'PENDING'),
('Rashid Khan', 'Bowler', 'Spinner', 1500000, 'Afghanistan', 25, 'PENDING'),
('AB de Villiers', 'Batsman', 'Middle Order', 1700000, 'South Africa', 40, 'PENDING'),
('MS Dhoni', 'Wicket-keeper', 'Finisher', 1600000, 'India', 42, 'PENDING');

-- Sample auction configuration
INSERT INTO auction_config (name, description, budget_cap, max_players_per_team) VALUES
('IPL 2024 Auction', 'Indian Premier League 2024 Player Auction', 10000000, 25);

-- =====================================================
-- 10. COMPLETION MESSAGE
-- =====================================================
-- Database has been completely reset and recreated!
-- 
-- What was created:
-- ✅ All tables with current schema
-- ✅ All necessary indexes for performance
-- ✅ All triggers for automatic updates
-- ✅ All functions for business logic
-- ✅ All views for reporting
-- ✅ Row Level Security policies
-- ✅ Sample data for testing
--
-- Next steps:
-- 1. Verify the database structure in Supabase dashboard
-- 2. Test the application functionality
-- 3. Add more sample data if needed
-- 4. Configure storage buckets for images 