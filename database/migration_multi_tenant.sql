-- =====================================================
-- Multi-Tenant Auction System Database Migration
-- =====================================================
-- This migration transforms Auction.io into a multi-tenant system where:
-- - Each user can create multiple auctions
-- - Players belong to user's pool (reusable across their auctions)
-- - Teams belong to specific auctions
-- 
-- RUN THIS MIGRATION CAREFULLY - It modifies existing tables!
-- =====================================================

-- =====================================================
-- PHASE 1: Create NEW tables first
-- =====================================================

-- 1. Create AUCTIONS table (replaces auction_config concept)
CREATE TABLE IF NOT EXISTS auctions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(200) NOT NULL,
    public_slug VARCHAR(50) UNIQUE,
    description TEXT,
    
    -- Auction configuration (merged from auction_config)
    budget_per_team DECIMAL(12,2) NOT NULL DEFAULT 10000000,
    max_players_per_team INTEGER NOT NULL DEFAULT 25,
    min_players_per_team INTEGER DEFAULT 15,
    
    -- Auction state
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    current_player_id UUID, -- Will reference auction_players after it's created
    current_player_position INTEGER DEFAULT 0,
    
    -- Public sharing
    is_public BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique auction names per owner
    CONSTRAINT unique_auction_name_per_owner UNIQUE (owner_id, name)
);

-- Generate public slug on insert if not provided
CREATE OR REPLACE FUNCTION generate_auction_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.public_slug IS NULL OR NEW.public_slug = '' THEN
        NEW.public_slug := LOWER(
            REPLACE(
                SUBSTRING(NEW.name FROM 1 FOR 20), 
                ' ', 
                '-'
            )
        ) || '-' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_auction_slug
    BEFORE INSERT ON auctions
    FOR EACH ROW EXECUTE FUNCTION generate_auction_slug();

-- =====================================================
-- PHASE 2: Modify PLAYERS table (add owner_id)
-- =====================================================

-- Add owner_id to players (nullable initially for existing data)
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Index for owner lookup
CREATE INDEX IF NOT EXISTS idx_players_owner_id ON players(owner_id);

-- =====================================================
-- PHASE 3: Modify TEAMS table (add owner_id, auction_id)
-- =====================================================

-- Add owner_id and auction_id to teams
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE;

-- Drop the old unique constraint on name (since names can repeat across auctions)
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_name_key;
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_short_name_key;

-- Add new unique constraint: name unique within auction
ALTER TABLE teams 
ADD CONSTRAINT unique_team_name_per_auction UNIQUE (auction_id, name);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_auction_id ON teams(auction_id);

-- =====================================================
-- PHASE 4: Create AUCTION_PLAYERS junction table
-- =====================================================
-- This links players from user's pool to specific auctions
-- with auction-specific pricing and status

CREATE TABLE IF NOT EXISTS auction_players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE NOT NULL,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    
    -- Auction-specific data
    base_price DECIMAL(10,2) DEFAULT 100000,
    sold_price DECIMAL(10,2),
    assigned_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    
    -- Status within this auction
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'current', 'sold', 'unsold', 'skipped')),
    auction_order INTEGER, -- Order in the auction queue
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Each player can only be in an auction once
    CONSTRAINT unique_player_per_auction UNIQUE (auction_id, player_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auction_players_auction_id ON auction_players(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_players_player_id ON auction_players(player_id);
CREATE INDEX IF NOT EXISTS idx_auction_players_status ON auction_players(status);
CREATE INDEX IF NOT EXISTS idx_auction_players_order ON auction_players(auction_id, auction_order);

-- =====================================================
-- PHASE 5: Modify TEAM_PLAYERS table
-- =====================================================
-- Add reference to auction context

ALTER TABLE team_players 
ADD COLUMN IF NOT EXISTS auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE;

ALTER TABLE team_players 
ADD COLUMN IF NOT EXISTS auction_player_id UUID REFERENCES auction_players(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_players_auction_id ON team_players(auction_id);

-- =====================================================
-- PHASE 6: Modify AUCTION_HISTORY table
-- =====================================================

ALTER TABLE auction_history 
ADD COLUMN IF NOT EXISTS auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE;

ALTER TABLE auction_history 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_auction_history_auction_id ON auction_history(auction_id);

-- =====================================================
-- PHASE 7: Updated RLS Policies for Multi-Tenancy
-- =====================================================

-- Drop old policies
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON teams;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON players;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON team_players;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON auction_history;

-- AUCTIONS policies
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;

-- Owners can manage their own auctions
CREATE POLICY "Users can manage own auctions" ON auctions
    FOR ALL USING (owner_id = auth.uid());

-- Super admin can see all
CREATE POLICY "Super admin full access to auctions" ON auctions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Public can view public auctions (via slug)
CREATE POLICY "Public can view public auctions" ON auctions
    FOR SELECT USING (is_public = true);

-- PLAYERS policies (owner-based)
CREATE POLICY "Users can manage own players" ON players
    FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Super admin full access to players" ON players
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Public can view players if they are in a public auction
CREATE POLICY "Public can view players in public auctions" ON players
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auction_players
            JOIN auctions ON auctions.id = auction_players.auction_id
            WHERE auction_players.player_id = players.id 
            AND auctions.is_public = true
        )
    );

-- TEAMS policies (auction owner-based)
CREATE POLICY "Users can manage teams in own auctions" ON teams
    FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Super admin full access to teams" ON teams
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Public can view teams in public auctions
CREATE POLICY "Public can view teams in public auctions" ON teams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auctions 
            WHERE auctions.id = teams.auction_id AND auctions.is_public = true
        )
    );

-- AUCTION_PLAYERS policies
ALTER TABLE auction_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage auction_players in own auctions" ON auction_players
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auctions 
            WHERE auctions.id = auction_players.auction_id AND auctions.owner_id = auth.uid()
        )
    );

CREATE POLICY "Super admin full access to auction_players" ON auction_players
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Public can view auction_players in public auctions
CREATE POLICY "Public can view auction_players in public auctions" ON auction_players
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auctions 
            WHERE auctions.id = auction_players.auction_id AND auctions.is_public = true
        )
    );

-- TEAM_PLAYERS policies
CREATE POLICY "Users can manage team_players in own auctions" ON team_players
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auctions 
            WHERE auctions.id = team_players.auction_id AND auctions.owner_id = auth.uid()
        )
    );

CREATE POLICY "Super admin full access to team_players" ON team_players
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Public can view team_players in public auctions
CREATE POLICY "Public can view team_players in public auctions" ON team_players
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auctions 
            WHERE auctions.id = team_players.auction_id AND auctions.is_public = true
        )
    );

-- AUCTION_HISTORY policies
CREATE POLICY "Users can view own auction history" ON auction_history
    FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Super admin full access to auction_history" ON auction_history
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Public can view auction_history in public auctions
CREATE POLICY "Public can view auction_history in public auctions" ON auction_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auctions 
            WHERE auctions.id = auction_history.auction_id AND auctions.is_public = true
        )
    );

-- =====================================================
-- PHASE 8: Trigger for auction updated_at
-- =====================================================

CREATE TRIGGER trigger_auctions_updated_at
    BEFORE UPDATE ON auctions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_auction_players_updated_at
    BEFORE UPDATE ON auction_players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PHASE 9: Update user_roles for super_admin
-- =====================================================
-- IMPORTANT: Drop constraint FIRST to allow data updates

-- Step 1: Drop existing constraint
ALTER TABLE user_roles 
DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- Step 2: Update existing roles to match new schema
-- Convert 'admin' to 'super_admin', 'viewer' to 'user'
UPDATE user_roles SET role = 'super_admin' WHERE role = 'admin';
UPDATE user_roles SET role = 'user' WHERE role = 'viewer';
UPDATE user_roles SET role = 'user' WHERE role NOT IN ('super_admin', 'user');

-- Step 3: Add new constraint with allowed values
ALTER TABLE user_roles 
ADD CONSTRAINT user_roles_role_check 
CHECK (role IN ('super_admin', 'user'));

-- =====================================================
-- MIGRATION NOTES
-- =====================================================
-- 
-- After running this migration:
-- 
-- 1. Assign super_admin role to platform owner:
--    UPDATE user_roles SET role = 'super_admin' WHERE user_id = 'YOUR_USER_ID';
--    
-- 2. For existing data, you'll need to:
--    - Assign owner_id to existing players
--    - Create an auction and move existing teams to it
--    
-- 3. The old auction_config table can be deprecated after data migration
--
-- =====================================================
