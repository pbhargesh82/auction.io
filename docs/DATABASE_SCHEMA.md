# 🗄️ Auction.io Database Schema Design (Supabase PostgreSQL)

## 🎯 Database Design Overview

This database schema is designed for a **simplified fantasy sports auction platform** with single admin management. The design focuses on:

- **Single Admin Use**: No complex multi-user authentication
- **Manual Auction Control**: Admin-controlled bidding process
- **Team & Player Management**: Simple CRUD operations
- **Budget Tracking**: Real-time budget calculations
- **Historical Data**: Auction results and analytics

## 📊 Entity Relationship Diagram

```mermaid
erDiagram
    TEAMS ||--o{ TEAM_PLAYERS : has
    PLAYERS ||--o{ TEAM_PLAYERS : "assigned to"
    -- PLAYER_QUEUE relationship removed - using players table directly
    AUCTION_CONFIG ||--o{ AUCTION_HISTORY : tracks
    TEAMS ||--o{ AUCTION_HISTORY : participates
    PLAYERS ||--o{ AUCTION_HISTORY : featured
    
    TEAMS {
        uuid id PK
        string name
        string short_name
        string logo_url
        string primary_color
        decimal budget_cap
        decimal budget_spent
        integer players_count
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }
    
    PLAYERS {
        uuid id PK
        string name
        string position
        string category
        decimal base_price
        string image_url
        string nationality
        integer age
        boolean is_sold
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }
    
    AUCTION_CONFIG {
        uuid id PK
        string name
        decimal budget_cap
        integer max_players_per_team
        string status
        uuid current_player_id FK
        timestamp created_at
        timestamp updated_at
    }
    
    PLAYER_QUEUE {
        uuid id PK
        uuid player_id FK
        integer queue_order
        string status
        timestamp created_at
    }
    
    TEAM_PLAYERS {
        uuid id PK
        uuid team_id FK
        uuid player_id FK
        decimal purchase_price
        timestamp purchased_at
    }
    
    AUCTION_HISTORY {
        uuid id PK
        uuid player_id FK
        uuid winning_team_id FK
        decimal final_price
        timestamp sold_at
        string notes
    }
```

## 📋 Detailed Table Specifications

### 1. `teams` - Team Management
**Purpose**: Store team information, logos, and budget tracking

```sql
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
```

**Computed Fields:**
- `budget_remaining`: Automatically calculated as `budget_cap - budget_spent`

### 2. `players` - Player Pool Management
**Purpose**: Store all available players for auction

```sql
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
```

**Example Categories:**
- **Cricket**: Batsman, Bowler, All-rounder, Wicket-keeper
- **Football**: Forward, Midfielder, Defender, Goalkeeper
- **Basketball**: Point Guard, Shooting Guard, Small Forward, etc.

### 3. `auction_config` - Auction Settings
**Purpose**: Single auction configuration (only one active auction at a time)

```sql
CREATE TABLE auction_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    budget_cap DECIMAL(12,2) NOT NULL DEFAULT 10000000,
    max_players_per_team INTEGER NOT NULL DEFAULT 25,
    min_players_per_team INTEGER DEFAULT 15,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED')),
    current_player_id UUID REFERENCES players(id),
    current_player_position INTEGER DEFAULT 0,
    total_players INTEGER DEFAULT 0,
    -- auction_type field removed - timer functionality will be per-player, not per-auction
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Ensure only one active auction at a time
CREATE UNIQUE INDEX idx_auction_config_active ON auction_config (status) 
WHERE status IN ('ACTIVE', 'PAUSED');
```

### 4. `player_queue` - REMOVED
**Purpose**: Auction order management moved to players table

The `player_queue` table has been removed. Auction order is now managed directly through the `auction_status` field in the `players` table.

**Migration Notes:**
- All player queue functionality has been moved to the players table
- The `auction_status` field in players table now handles all queue operations
- This simplifies the database schema and reduces complexity

### 5. `team_players` - Final Team Rosters
**Purpose**: Store final team compositions after auction

```sql
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
```

### 6. `auction_history` - Auction Transaction Log
**Purpose**: Track all auction activities for analytics and history

```sql
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
```

### 7. `storage_buckets` - File Storage Configuration
**Purpose**: Supabase storage bucket configuration

```sql
-- This will be created in Supabase Storage, not as a table
-- Buckets: 'team-logos', 'player-images', 'exports'
```

## 🔐 Row Level Security (RLS) Policies

Since this is a single admin application, RLS policies will be simple:

```sql
-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_config ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE player_queue ENABLE ROW LEVEL SECURITY; -- REMOVED
ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admin) full access
CREATE POLICY "Enable all operations for authenticated users" ON teams
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON players
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON auction_config
    FOR ALL USING (auth.role() = 'authenticated');

-- CREATE POLICY "Enable all operations for authenticated users" ON player_queue
--     FOR ALL USING (auth.role() = 'authenticated'); -- REMOVED

CREATE POLICY "Enable all operations for authenticated users" ON team_players
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON auction_history
    FOR ALL USING (auth.role() = 'authenticated');
```

## 📊 Database Views for Analytics

### 1. Team Statistics View
```sql
CREATE VIEW team_stats AS
SELECT 
    t.id,
    t.name,
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
GROUP BY t.id, t.name, t.budget_cap, t.budget_spent, t.budget_remaining, t.players_count;
```

### 2. Auction Progress View
```sql
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
```

### 3. Player Categories Summary
```sql
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
```

## 🗃️ Database Functions and Triggers

### 1. Update Team Budget Trigger
```sql
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

-- Create trigger
CREATE TRIGGER trigger_update_team_budget
    AFTER INSERT OR DELETE ON team_players
    FOR EACH ROW EXECUTE FUNCTION update_team_budget();
```

### 2. Auction Queue Management Function
```sql
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
```

## 📈 Indexes for Performance

```sql
-- Performance indexes
CREATE INDEX idx_players_category_position ON players(category, position);
CREATE INDEX idx_players_is_sold ON players(is_sold);
CREATE INDEX idx_player_queue_status_order ON player_queue(status, queue_order);
CREATE INDEX idx_team_players_team_id ON team_players(team_id);
CREATE INDEX idx_team_players_purchased_at ON team_players(purchased_at);
CREATE INDEX idx_auction_history_auction_date ON auction_history(auction_date);
CREATE INDEX idx_teams_is_active ON teams(is_active);

-- Full text search indexes
CREATE INDEX idx_players_name_search ON players USING gin(to_tsvector('english', name));
CREATE INDEX idx_teams_name_search ON teams USING gin(to_tsvector('english', name));
```

## 🧪 Sample Data Setup

### Sample Teams
```sql
INSERT INTO teams (name, short_name, primary_color, budget_cap) VALUES
('Mumbai Warriors', 'MW', '#0066cc', 10000000),
('Delhi Capitals', 'DC', '#cc0000', 10000000),
('Chennai Super Kings', 'CSK', '#ffcc00', 10000000),
('Kolkata Knight Riders', 'KKR', '#6600cc', 10000000);
```

### Sample Players
```sql
INSERT INTO players (name, position, category, base_price, nationality, age) VALUES
('Virat Kohli', 'Batsman', 'Top Order', 2000000, 'India', 35),
('Rohit Sharma', 'Batsman', 'Top Order', 2000000, 'India', 36),
('Jasprit Bumrah', 'Bowler', 'Fast Bowler', 1800000, 'India', 30),
('Rashid Khan', 'Bowler', 'Spinner', 1500000, 'Afghanistan', 25);
```

This database schema provides a robust foundation for your auction.io platform with proper normalization, performance optimization, and data integrity constraints. The design supports both the current simplified requirements and future enhancements. 