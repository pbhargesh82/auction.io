-- =====================================================
-- Auction.io Database Schema for Supabase PostgreSQL
-- =====================================================
-- This script creates all tables, indexes, triggers, and functions
-- for the fantasy sports auction management platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. TEAMS TABLE - Team Management
-- =====================================================
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

-- =====================================================
-- 2. PLAYERS TABLE - Player Pool Management
-- =====================================================
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
    is_sold BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT players_base_price_check CHECK (base_price > 0),
    CONSTRAINT players_age_check CHECK (age > 0 AND age < 100),
    CONSTRAINT players_experience_check CHECK (experience_years >= 0)
);

-- =====================================================
-- 3. AUCTION CONFIG TABLE - Auction Settings
-- =====================================================
CREATE TABLE auction_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    budget_cap DECIMAL(12,2) NOT NULL DEFAULT 10000000,
    max_players_per_team INTEGER NOT NULL DEFAULT 25,
    min_players_per_team INTEGER DEFAULT 15,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED')),
    current_player_id UUID REFERENCES players(id),
    current_player_position INTEGER DEFAULT 0,
    total_players INTEGER DEFAULT 0,
    auction_type VARCHAR(20) DEFAULT 'MANUAL' CHECK (auction_type IN ('MANUAL', 'TIMER')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- =====================================================
-- 4. PLAYER QUEUE TABLE - Auction Order Management
-- =====================================================
CREATE TABLE player_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    queue_order INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CURRENT', 'SOLD', 'UNSOLD', 'SKIPPED')),
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure unique order and player
    UNIQUE(player_id),
    UNIQUE(queue_order)
);

-- =====================================================
-- 5. TEAM PLAYERS TABLE - Final Team Rosters
-- =====================================================
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

-- =====================================================
-- 6. AUCTION HISTORY TABLE - Transaction Log
-- =====================================================
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
-- INDEXES FOR PERFORMANCE
-- =====================================================
-- Teams indexes
CREATE INDEX idx_teams_is_active ON teams(is_active);
CREATE INDEX idx_teams_name_search ON teams USING gin(to_tsvector('english', name));

-- Players indexes
CREATE INDEX idx_players_category_position ON players(category, position);
CREATE INDEX idx_players_is_sold ON players(is_sold);
CREATE INDEX idx_players_name_search ON players USING gin(to_tsvector('english', name));

-- Player queue indexes
CREATE INDEX idx_player_queue_status_order ON player_queue(status, queue_order);

-- Team players indexes
CREATE INDEX idx_team_players_team_id ON team_players(team_id);
CREATE INDEX idx_team_players_purchased_at ON team_players(purchased_at);

-- Auction history indexes
CREATE INDEX idx_auction_history_auction_date ON auction_history(auction_date);

-- Unique constraint for only one active auction
CREATE UNIQUE INDEX idx_auction_config_active ON auction_config (status) 
WHERE status IN ('ACTIVE', 'PAUSED');

-- =====================================================
-- DATABASE FUNCTIONS
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
        
        -- Mark player as sold
        UPDATE players 
        SET is_sold = true, updated_at = NOW()
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
        SET is_sold = false, updated_at = NOW()
        WHERE id = OLD.player_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to get next player in queue
CREATE OR REPLACE FUNCTION get_next_player()
RETURNS UUID AS $$
DECLARE
    next_player_id UUID;
BEGIN
    SELECT player_id INTO next_player_id
    FROM player_queue
    WHERE status = 'PENDING'
    ORDER BY queue_order
    LIMIT 1;
    
    IF next_player_id IS NOT NULL THEN
        -- Update current player status
        UPDATE player_queue 
        SET status = 'CURRENT'
        WHERE player_id = next_player_id;
        
        -- Update auction config
        UPDATE auction_config 
        SET current_player_id = next_player_id,
            current_player_position = (
                SELECT queue_order 
                FROM player_queue 
                WHERE player_id = next_player_id
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
-- TRIGGERS
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
-- DATABASE VIEWS
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
    ac.name as auction_name,
    ac.status,
    COUNT(pq.id) as total_players,
    COUNT(CASE WHEN pq.status = 'SOLD' THEN 1 END) as players_sold,
    COUNT(CASE WHEN pq.status = 'UNSOLD' THEN 1 END) as players_unsold,
    COUNT(CASE WHEN pq.status = 'PENDING' THEN 1 END) as players_remaining,
    COALESCE(SUM(ah.final_price), 0) as total_amount_spent,
    ac.current_player_position,
    (COUNT(CASE WHEN pq.status IN ('SOLD', 'UNSOLD') THEN 1 END) * 100.0 / NULLIF(COUNT(pq.id), 0)) as completion_percentage
FROM auction_config ac
LEFT JOIN player_queue pq ON true
LEFT JOIN auction_history ah ON ah.auction_date = CURRENT_DATE
GROUP BY ac.id, ac.name, ac.status, ac.current_player_position;

-- Player category statistics view
CREATE VIEW player_category_stats AS
SELECT 
    p.category,
    p.position,
    COUNT(*) as total_players,
    COUNT(CASE WHEN p.is_sold = true THEN 1 END) as sold_players,
    COALESCE(AVG(tp.purchase_price), 0) as avg_price,
    COALESCE(MAX(tp.purchase_price), 0) as max_price,
    COALESCE(MIN(tp.purchase_price), 0) as min_price
FROM players p
LEFT JOIN team_players tp ON p.id = tp.player_id
GROUP BY p.category, p.position
ORDER BY p.category, p.position;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admin) full access
CREATE POLICY "Enable all operations for authenticated users" ON teams
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON players
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON auction_config
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON player_queue
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON team_players
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON auction_history
    FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Sample teams
INSERT INTO teams (name, short_name, primary_color, budget_cap) VALUES
('Mumbai Warriors', 'MW', '#0066cc', 10000000),
('Delhi Capitals', 'DC', '#cc0000', 10000000),
('Chennai Super Kings', 'CSK', '#ffcc00', 10000000),
('Kolkata Knight Riders', 'KKR', '#6600cc', 10000000);

-- Sample players
INSERT INTO players (name, position, category, base_price, nationality, age) VALUES
('Virat Kohli', 'Batsman', 'Top Order', 2000000, 'India', 35),
('Rohit Sharma', 'Batsman', 'Top Order', 2000000, 'India', 36),
('Jasprit Bumrah', 'Bowler', 'Fast Bowler', 1800000, 'India', 30),
('Rashid Khan', 'Bowler', 'Spinner', 1500000, 'Afghanistan', 25),
('AB de Villiers', 'Batsman', 'Middle Order', 1700000, 'South Africa', 40),
('MS Dhoni', 'Wicket-keeper', 'Finisher', 1600000, 'India', 42);

-- Sample auction configuration
INSERT INTO auction_config (name, description, budget_cap, max_players_per_team, status) VALUES
('IPL 2024 Auction', 'Indian Premier League 2024 Player Auction', 10000000, 25, 'DRAFT');

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
-- Database schema created successfully!
-- Next steps:
-- 1. Run this script in your Supabase SQL editor
-- 2. Create storage buckets for team logos and player images
-- 3. Test the database operations
-- 4. Start building your Angular application 