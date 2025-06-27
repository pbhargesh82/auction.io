# 🗄️ Auction.io Simplified Database Schema (Supabase)

## Overview

This document outlines the simplified database schema for the Auction.io platform using Supabase PostgreSQL, focusing on single admin auction management.

## 📊 Simplified Entity Relationship Diagram

```
┌─────────────┐    ┌─────────────┐
│    Teams    │────│TeamPlayers  │
└─────────────┘    └─────────────┘
       │                   │
       │                   │
┌─────────────┐    ┌─────────────┐
│AuctionConfig│    │   Players   │
└─────────────┘    └─────────────┘
       │                   │
       │                   │
┌─────────────┐    ┌─────────────┐
│PlayerQueue  │────│             │
└─────────────┘    └─────────────┘
```

## 📋 Simplified Database Tables

### 1. Teams Table
**Purpose**: Store team information and settings

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique team identifier |
| name | VARCHAR(100) | NOT NULL | Team name |
| short_name | VARCHAR(10) | NULL | Team abbreviation |
| logo_url | TEXT | NULL | Team logo URL (Supabase Storage) |
| primary_color | VARCHAR(7) | NULL | Hex color code |
| budget_cap | DECIMAL(12,2) | DEFAULT 0 | Team budget limit |
| budget_spent | DECIMAL(12,2) | DEFAULT 0 | Amount spent |
| players_count | INTEGER | DEFAULT 0 | Current players count |
| is_active | BOOLEAN | DEFAULT TRUE | Team status |
| created_at | TIMESTAMP | DEFAULT NOW() | Team creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last team update |

### 2. Players Table
**Purpose**: Store player information and attributes

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique player identifier |
| name | VARCHAR(100) | NOT NULL | Player full name |
| position | VARCHAR(50) | NOT NULL | Player position |
| category | VARCHAR(50) | NOT NULL | Player category (e.g., Batsman, Bowler) |
| base_price | DECIMAL(10,2) | NOT NULL | Minimum bid amount |
| image_url | TEXT | NULL | Player photo URL (Supabase Storage) |
| nationality | VARCHAR(50) | NULL | Player nationality |
| age | INTEGER | NULL | Player age |
| is_sold | BOOLEAN | DEFAULT FALSE | Whether player is sold |
| is_active | BOOLEAN | DEFAULT TRUE | Player availability |
| created_at | TIMESTAMP | DEFAULT NOW() | Player creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last player update |

### 3. Auction Config Table
**Purpose**: Store single auction configuration (only one active auction)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique auction identifier |
| name | VARCHAR(200) | NOT NULL | Auction title |
| budget_cap | DECIMAL(12,2) | NOT NULL | Maximum team budget |
| max_players_per_team | INTEGER | NOT NULL | Player limit per team |
| status | VARCHAR(20) | NOT NULL | 'DRAFT', 'ACTIVE', 'COMPLETED' |
| current_player_id | UUID | NULL | Currently auctioned player |
| created_at | TIMESTAMP | DEFAULT NOW() | Auction creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last auction update |

### 4. Player Queue Table
**Purpose**: Manage player order in auction

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique queue identifier |
| player_id | UUID | REFERENCES players(id) | Player reference |
| queue_order | INTEGER | NOT NULL | Player position in queue |
| status | VARCHAR(20) | DEFAULT 'PENDING' | 'PENDING', 'CURRENT', 'SOLD', 'UNSOLD' |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation time |

### 5. Team Players Table
**Purpose**: Store final team rosters after auction completion

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique roster identifier |
| team_id | UUID | REFERENCES teams(id) | Team reference |
| player_id | UUID | REFERENCES players(id) | Player reference |
| purchase_price | DECIMAL(10,2) | NOT NULL | Final purchase price |
| purchased_at | TIMESTAMP | DEFAULT NOW() | Purchase timestamp |

## 🗂️ Supabase SQL Schema

### Create Tables Script
```sql
-- Teams table
CREATE TABLE teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  short_name VARCHAR(10),
  logo_url TEXT,
  primary_color VARCHAR(7),
  budget_cap DECIMAL(12,2) DEFAULT 0,
  budget_spent DECIMAL(12,2) DEFAULT 0,
  players_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Players table
CREATE TABLE players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  position VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  nationality VARCHAR(50),
  age INTEGER,
  is_sold BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Auction config table (single auction)
CREATE TABLE auction_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  budget_cap DECIMAL(12,2) NOT NULL,
  max_players_per_team INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'DRAFT',
  current_player_id UUID REFERENCES players(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Player queue table
CREATE TABLE player_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id),
  queue_order INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Team players table (final rosters)
CREATE TABLE team_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  player_id UUID REFERENCES players(id),
  purchase_price DECIMAL(10,2) NOT NULL,
  purchased_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, player_id)
);

-- Create indexes for better performance
CREATE INDEX idx_players_position ON players(position);
CREATE INDEX idx_players_category ON players(category);
CREATE INDEX idx_player_queue_order ON player_queue(queue_order);
CREATE INDEX idx_team_players_team_id ON team_players(team_id);
```

## 🔗 Foreign Key Relationships

### Primary Relationships
1. **Users → Teams**: One-to-Many (owner_id)
2. **Teams → AuctionTeams**: One-to-Many (team_id)
3. **Auctions → AuctionTeams**: One-to-Many (auction_id)
4. **Auctions → Bids**: One-to-Many (auction_id)
5. **Players → Bids**: One-to-Many (player_id)
6. **Teams → Bids**: One-to-Many (team_id)
7. **Auctions → TeamPlayers**: One-to-Many (auction_id)
8. **Teams → TeamPlayers**: One-to-Many (team_id)
9. **Players → TeamPlayers**: One-to-Many (player_id)

### Secondary Relationships
1. **Users → Players**: One-to-Many (created_by)
2. **Users → Auctions**: One-to-Many (created_by)
3. **Auctions → Players**: Many-to-One (current_player_id)
4. **Auctions → Teams**: Many-to-One (current_bid_team_id)

## 📈 Database Views

### 1. AuctionTeamStats View
```sql
CREATE VIEW auction_team_stats AS
SELECT 
    at.auction_id,
    at.team_id,
    t.name as team_name,
    at.budget_remaining,
    at.total_spent,
    at.players_count,
    COALESCE(tp.sold_players, 0) as players_bought,
    (a.budget_cap - at.total_spent) as budget_left,
    (a.max_players_per_team - at.players_count) as spots_remaining
FROM auction_teams at
JOIN teams t ON at.team_id = t.id
JOIN auctions a ON at.auction_id = a.id
LEFT JOIN (
    SELECT team_id, auction_id, COUNT(*) as sold_players
    FROM team_players
    GROUP BY team_id, auction_id
) tp ON at.team_id = tp.team_id AND at.auction_id = tp.auction_id;
```

### 2. AuctionProgress View
```sql
CREATE VIEW auction_progress AS
SELECT 
    a.id as auction_id,
    a.name as auction_name,
    a.status,
    COUNT(DISTINCT pq.player_id) as total_players,
    COUNT(DISTINCT CASE WHEN pq.status = 'SOLD' THEN pq.player_id END) as sold_players,
    COUNT(DISTINCT CASE WHEN pq.status = 'UNSOLD' THEN pq.player_id END) as unsold_players,
    COUNT(DISTINCT CASE WHEN pq.status = 'PENDING' THEN pq.player_id END) as pending_players,
    SUM(CASE WHEN tp.purchase_price IS NOT NULL THEN tp.purchase_price ELSE 0 END) as total_money_spent
FROM auctions a
LEFT JOIN player_queue pq ON a.id = pq.auction_id
LEFT JOIN team_players tp ON a.id = tp.auction_id
GROUP BY a.id, a.name, a.status;
```

## 🔧 Database Functions & Triggers

### 1. Update Team Stats Trigger
```sql
CREATE OR REPLACE FUNCTION update_team_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE auction_teams 
        SET 
            players_count = players_count + 1,
            total_spent = total_spent + NEW.purchase_price,
            budget_remaining = budget_remaining - NEW.purchase_price
        WHERE team_id = NEW.team_id AND auction_id = NEW.auction_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_team_stats
    AFTER INSERT ON team_players
    FOR EACH ROW
    EXECUTE FUNCTION update_team_stats();
```

## 📊 Performance Considerations

### Indexing Strategy
- **Primary Keys**: All tables use UUID primary keys with clustered indexes
- **Foreign Keys**: All foreign key columns are indexed
- **Query Optimization**: Composite indexes on frequently queried column combinations
- **Search Optimization**: Full-text search indexes on name and description fields

### Partitioning Strategy
- **Bids Table**: Partition by auction_id for better query performance
- **BidHistory Table**: Partition by created_at (monthly) for historical data management

### Caching Strategy
- **Redis Cache**: Frequently accessed auction data
- **Query Result Cache**: Complex analytical queries
- **Session Cache**: User authentication and team data

## 🔒 Security Considerations

### Data Protection
- **Sensitive Data**: Password hashes using bcrypt
- **Input Validation**: All inputs validated at application level
- **SQL Injection**: Prevented through Prisma ORM
- **Access Control**: Role-based permissions at application level

### Audit Trail
- **User Actions**: All critical actions logged in BidHistory
- **Data Changes**: Timestamps on all records
- **System Events**: Application-level logging for monitoring

This comprehensive database schema provides a solid foundation for the Auction.io platform, ensuring data integrity, performance, and scalability. 