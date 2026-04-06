# 🎨 Auction.io — Multi-Auction UI/UX Redesign Plan

> **Author**: Senior Frontend Architecture Review  
> **Date**: April 2026  
> **Status**: 📋 PROPOSAL — Awaiting Approval  
> **Scope**: Complete navigation & information-architecture overhaul to support per-user, per-auction workflows

---

## 📌 Executive Summary

Auction.io was originally designed as a **single-auction-at-a-time** tool with a flat sidebar navigation. Now that users can create **multiple auctions**, share them publicly, and each auction has its own teams, players, history, and roster — the UI needs a fundamental restructure.

### The Core Problem

The current flat navigation (`Dashboard → Auctions → Auction Control → History → Team Roster → Teams → My Players`) treats everything as global. But in a multi-auction world:

- **Teams belong to an auction**, not to the user globally
- **Team Roster is per-auction**, not global
- **Auction History is per-auction**, not global
- **Auction Control is per-auction**, not global
- **The "auction selector" dropdown in the header** is a band-aid — it's easy to forget which auction you're working with

### The Solution

**Auction-Centric Navigation** — The auction becomes the primary organizational unit. Users work *inside* an auction workspace, and all sub-pages (teams, control, roster, history) live under that auction context. The global-level pages are only for cross-cutting concerns: your player pool, your list of auctions, and account settings.

---

## 🧭 New Information Architecture

### Level 1: Global (User-Level)

These are things that exist *independently* of any specific auction.

| Page | Purpose | Notes |
|------|---------|-------|
| **Home / My Auctions** | Grid/list of all user's auctions with status badges, quick actions | **New landing page after login** |
| **Player Pool** | User's reusable player catalog (add, edit, import CSV) | Renamed from "My Players" — this is your master roster |
| **Account / Settings** | Profile, preferences, theme toggle | Currently missing |

### Level 2: Auction Workspace (Auction-Level)

When you click into an auction from the Home page, you enter the **Auction Workspace**. All pages within are scoped to that auction.

| Page | Purpose | Notes |
|------|---------|-------|
| **Auction Overview** | Dashboard for *this* auction — teams, budget summary, progress, quick stats | Replaces the current global "Dashboard" |
| **Teams** | Manage teams for *this* auction — CRUD, colors, budget caps | Already scoped via `auction_id`, but UI doesn't reflect it |
| **Player Pool (Auction)** | Add players from your global pool into *this* auction, set base prices | Maps to `auction_players` junction table |
| **Auction Control** | Live auction control panel — sell, skip, search players | Already exists, needs slight context updates |
| **Team Rosters** | View all team compositions for *this* auction | Currently global — needs to be scoped |
| **Auction History** | Transaction log for *this* auction | Currently global — needs to be scoped |
| **Settings** | Auction-specific config (budget, player limits, public slug, sharing) | Moved from `auction-config` |
| **Public View** | Public sharing page (read-only, no auth) | Already exists at `/view/:slug` |

---

## 🗺️ Proposed Route Structure

```
/login                          → Login page (unchanged)
/auth/callback                  → OAuth callback (unchanged)
/view/:slug                     → Public auction view (unchanged)

/                               → Redirect to /home
/home                           → My Auctions grid (LIST of all auctions)
/player-pool                    → Global player management

/auction/:id                    → Redirect to /auction/:id/overview
/auction/:id/overview           → Auction dashboard/overview
/auction/:id/teams              → Teams for this auction
/auction/:id/players            → Players added to this auction
/auction/:id/control            → Live auction control
/auction/:id/rosters            → Team rosters for this auction
/auction/:id/history            → Auction history log
/auction/:id/settings           → Auction settings/config

/settings                       → User account settings
/user-management                → Super admin user management
```

### Key Routing Changes

| Old Route | New Route | Reason |
|-----------|-----------|--------|
| `/dashboard` | `/home` | Dashboard was pretending to be global; the real "home" is your auction list |
| `/auctions` | `/home` | Merged — the auction list IS the home page |
| `/teams` | `/auction/:id/teams` | Teams are per-auction |
| `/team-roster` | `/auction/:id/rosters` | Rosters are per-auction |
| `/auction-control` | `/auction/:id/control` | Control is per-auction |
| `/auction-history` | `/auction/:id/history` | History is per-auction |
| `/auction-config` | `/auction/:id/settings` | Config is per-auction |
| `/players` | `/player-pool` | Renamed for clarity — this is your global player catalog |
| `/analytics` | `/auction/:id/overview` | Analytics merged into auction overview |

---

## 🧩 Navigation Redesign

### Current Navigation (Flat Sidebar)

```
├── Dashboard          ← Global? Or per-auction? Unclear
├── Auctions           ← List of auctions (separate page)
├── Auction Control    ← Which auction? The "selected" one? Confusing
├── Auction History    ← Same confusion
├── Team Roster        ← Same confusion 
├── Teams              ← Same confusion
├── My Players         ← Global (correct), but naming is ambiguous
└── User Management    ← Admin only
```

**Problems:**
1. No visual separation between "global" and "auction-scoped" pages
2. The auction selector dropdown in the header is invisible on mobile
3. Switching auctions doesn't change the URL — you can't bookmark or share a direct link
4. "My Players" sounds like "players assigned to me" not "player catalog"

### New Navigation (Two-Layer)

#### When on Global pages (`/home`, `/player-pool`, `/settings`):

```
┌─ SIDEBAR ─────────────────────────────────────────┐
│                                                    │
│  🏠  My Auctions               ← /home            │
│  🏏  Player Pool                ← /player-pool     │
│  ─────────────────────────                         │
│  ⚙️  Settings                   ← /settings        │
│  👥  User Management            ← /user-management │
│                                                    │
└────────────────────────────────────────────────────┘
```

#### When inside an Auction Workspace (`/auction/:id/*`):

```
┌─ SIDEBAR ─────────────────────────────────────────┐
│                                                    │
│  ← Back to My Auctions                            │
│                                                    │
│  🏆 [Auction Name]      [Status Badge]             │
│  ─────────────────────────                         │
│                                                    │
│  📊  Overview                 ← /auction/:id/overview  │
│  🏁  Teams                    ← /auction/:id/teams     │
│  🏏  Auction Players          ← /auction/:id/players   │
│  🔨  Auction Control          ← /auction/:id/control   │
│  📋  Team Rosters             ← /auction/:id/rosters   │
│  📜  History                  ← /auction/:id/history    │
│  ⚙️  Auction Settings         ← /auction/:id/settings  │
│                                                    │
│  ─────────────────────────                         │
│  🔗  Share Public Link        ← Copy slug link     │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Key UX wins:**
- **Context is obvious**: The auction name is prominently shown in the sidebar
- **"Back to My Auctions"** provides a clear escape hatch
- **URL reflects auction**: You can bookmark `/auction/abc-123/teams` and share it
- **No more dropdown confusion**: You don't "select" an auction — you navigate *into* it

---

## 📱 My Auctions Home Page (New)

This replaces both the old "Dashboard" and "Auctions" pages.

### Design: Card Grid

```
┌──────────────────────────────────────────────────────────┐
│  My Auctions                          [+ Create Auction] │
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────┐ │
│  │  IPL 2026        │  │  Office League   │  │  + New   │ │
│  │  ●  Live          │  │  ○  Draft        │  │  Auction │ │
│  │                   │  │                  │  │          │ │
│  │  6 Teams          │  │  4 Teams         │  │          │ │
│  │  32/50 Players    │  │  0/20 Players    │  │          │ │
│  │  ₹4.2M / ₹6M     │  │  ₹0 / ₹1M       │  │          │ │
│  │  ━━━━━━░░░        │  │  ░░░░░░░░░       │  │          │ │
│  │                   │  │                  │  │          │ │
│  │  [Enter] [Share]  │  │  [Enter] [⋯]    │  │          │ │
│  └─────────────────┘  └─────────────────┘  └──────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Each Auction Card shows:
- **Auction name** + **status badge** (Draft / Live / Completed)
- **Team count** & **Player progress** (sold/total)
- **Budget** progress bar
- **Quick actions**: Enter (navigate to workspace), Share (copy public link), Menu (edit, delete, duplicate)
- **Last activity** timestamp

---

## 🔍 "My Players" vs "Auction Players" — Decision

### Current Problem
The "My Players" page manages the user's **global player pool**. But once multi-auction is in play, players need to be added *into* a specific auction (via `auction_players` junction table) with auction-specific base prices and statuses.

### Decision: **Keep "Player Pool" as Global + Add "Auction Players" per-auction**

| Concept | Where | Purpose |
|---------|-------|---------|
| **Player Pool** (`/player-pool`) | Global | Your master catalog of players. Add, edit, import CSV, manage metadata. These are *templates* — no auction state here. |
| **Auction Players** (`/auction/:id/players`) | Per-Auction | From your global pool, pick which players participate in *this* auction. Set auction-specific base prices. View their status (available/sold/unsold). |

### Why keep the global pool?
- Users reuse the same players across multiple auctions (e.g., same cricket players, different league auctions)
- It avoids re-entering player data for every auction
- CSV import happens once at the pool level, then you just "add to auction"

### UX Flow for Adding Players to an Auction:
1. Go to `/auction/:id/players`
2. Click **"Add from Pool"**
3. A modal/sheet shows your global player pool with checkboxes
4. Select players → Click "Add to Auction"
5. Players appear in the auction with default base prices (editable)

---

## 📊 Auction Overview (New Dashboard)

The old "Dashboard" was a global page showing stats across all teams. The new **Auction Overview** is scoped to a single auction.

### Components:
1. **Auction Status Banner** — Name, status (Draft/Live/Completed), public link, date created
2. **Quick Stats Cards** — Teams count, Players sold/total, Budget spent/total, Progress %
3. **Team Summary Grid** — Mini team cards showing budget, player count, top purchase
4. **Activity Feed** — Last 5 auction transactions (sold/unsold actions)
5. **Quick Actions** — "Start Auction", "Add Players", "Share Link"

---

## 🗃️ Component Impact Analysis

### Components That STAY (with minor updates)

| Component | Change Needed |
|-----------|---------------|
| `login` | No change |
| `auth-callback` | No change |
| `public-auction` | No change (already uses slug) |
| `auction-control` | Update to receive `auctionId` from route param instead of context service |
| `team-card` | No change (already reusable) |
| `user-management` | No change |

### Components That Get REDESIGNED

| Component | Current | New |
|-----------|---------|-----|
| `layout` | Single sidebar, flat nav, auction dropdown | Two-mode sidebar (global vs auction workspace) |
| `dashboard` | Global stats | → Becomes `auction-overview` (per-auction) |
| `auctions` | Separate page with CRUD | → Becomes the home page card grid |
| `auction-selector` | Header dropdown | **REMOVED** — replaced by route-based navigation |
| `teams` | Global team list | Scoped to auction via route param |
| `players` | "My Players" global | → Split into `player-pool` (global) and `auction-players` (per-auction) |
| `team-roster` | Global roster | Scoped to auction via route param |
| `auction-history` | Global history | Scoped to auction via route param |
| `auction-config` | Separate config page | → Becomes `auction-settings` (per-auction) |

### NEW Components Needed

| Component | Purpose |
|-----------|---------|
| `home` | My Auctions grid — the new landing page |
| `auction-workspace-layout` | Layout wrapper for `/auction/:id/*` routes with auction-scoped sidebar |
| `auction-overview` | Per-auction dashboard with stats and activity |
| `auction-players` | Manage players within an auction (add from pool, set prices) |
| `player-pool` | Renamed/refactored "My Players" focused on global catalog |
| `auction-settings` | Per-auction configuration (merged from auction-config) |

---

## 🔄 Service Layer Changes

### `AuctionContextService` — **Deprecate & Remove**

The concept of a "selected auction" stored in `localStorage` is replaced by route params. Each page in the auction workspace reads `auctionId` from `ActivatedRoute.params`.

**Before:** `this.auctionContext.currentAuctionId()` (ambiguous, stored globally)  
**After:** `this.route.snapshot.paramMap.get('id')` (explicit, URL-based)

### `AuctionStateService` — **Keep but adapt**

This service already accepts an optional `auctionId` in `loadAllData(auctionId?)`. This is the correct pattern — it just needs to be consistently called with the route-based ID.

### New: `AuctionWorkspaceResolver`

A route resolver that:
1. Reads `:id` from the URL
2. Validates the auction exists and belongs to the user
3. Pre-loads auction data
4. Redirects to `/home` if invalid

---

## 🎯 Detailed Implementation Checklist

### Phase 1: Foundation & Routing (HIGH PRIORITY)
> Restructure routes and layout — no feature changes yet

- [x] **1.1** Create new route structure in `app.routes.ts`
  - [x] Add `/home` route
  - [x] Add `/player-pool` route
  - [x] Add `/auction/:id` parent route with children
  - [x] Add `/auction/:id/overview`, `/teams`, `/players`, `/control`, `/rosters`, `/history`, `/settings` child routes
  - [x] Add redirects from old routes to new ones (temporary, for existing bookmarks)
  - [x] Remove `/dashboard`, `/auctions`, `/teams`, `/players`, `/team-roster`, `/auction-control`, `/auction-history`, `/auction-config` routes

- [x] **1.2** Create `AuctionWorkspaceLayoutComponent`
  - [x] New layout component for `/auction/:id/*` routes
  - [x] Auction-scoped sidebar with "Back to My Auctions" button
  - [x] Display current auction name + status in sidebar header
  - [x] Per-auction navigation menu items
  - [x] Receive `auctionId` from route params

- [x] **1.3** Update `LayoutComponent` (Global Layout)
  - [x] Simplify sidebar to only show global nav items (My Auctions, Player Pool, Settings)
  - [x] Remove `AuctionSelectorComponent` from header
  - [x] Remove auction-specific menu items from sidebar

- [x] **1.4** Create route resolver/guard for auction workspace
  - [x] Validate auction ID exists
  - [x] Validate user ownership (or super_admin)
  - [x] Pre-load auction data into `AuctionStateService`
  - [x] Redirect to `/home` if invalid

---

### Phase 2: Home Page — My Auctions (HIGH PRIORITY)
> The new landing page after login

- [x] **2.1** Create `HomeComponent` (`/home`)
  - [x] Auction card grid layout
  - [x] Each card: name, status badge, team count, player progress, budget bar
  - [x] "Create Auction" card/button
  - [x] Quick actions per card: Enter, Share Link, Edit, Delete
  - [x] Empty state with onboarding guidance
  - [x] Search/filter auctions (by name, status)
  - [x] Responsive: 3-col desktop, 2-col tablet, 1-col mobile

- [x] **2.2** Migrate create/edit auction form from `AuctionsComponent`
  - [x] Reuse existing form logic
  - [x] Show as modal/dialog instead of inline form
  - [x] Add "Duplicate Auction" action

- [x] **2.3** Update auth guard redirect
  - [x] After login, redirect to `/home` instead of `/dashboard`
  - [x] Update `LoginComponent` redirect target

---

### Phase 3: Auction Overview (HIGH PRIORITY)
> Per-auction dashboard replacing the global dashboard

- [x] **3.1** Create `AuctionOverviewComponent` (`/auction/:id/overview`)
  - [x] Read `auctionId` from route params
  - [x] Auction status banner with name, status, public link
  - [x] Quick stat cards: Teams, Players Sold/Total, Budget Spent/Total, Progress %
  - [x] Team summary grid using `TeamCardComponent`
  - [x] Recent activity feed (last 5 transactions from auction_history)
  - [x] Quick action buttons: Start Auction, Add Players, Share

- [x] **3.2** Deprecate `DashboardComponent`
  - [x] Remove component or redirect to `/home`

---

### Phase 4: Scope Existing Components to Auction (MEDIUM PRIORITY)
> Adapt existing pages to work within the auction workspace

- [x] **4.1** Update `TeamsComponent`
  - [x] Read `auctionId` from route params (via parent route)
  - [x] Pass `auctionId` to `TeamsService` for CRUD operations
  - [x] Filter teams by `auction_id`
  - [x] Auto-set `auction_id` and `owner_id` when creating teams
  - [x] Update breadcrumb: "IPL 2026 > Teams"

- [x] **4.2** Update `TeamRosterComponent`
  - [x] Read `auctionId` from route params
  - [x] Filter team_players by `auction_id`
  - [x] Show only teams belonging to this auction
  - [x] Update breadcrumb

- [x] **4.3** Update `AuctionControlComponent`
  - [x] Read `auctionId` from route params
  - [x] Use auction-specific player list (from `auction_players`)
  - [x] Sell player → creates `team_players` record with `auction_id`
  - [x] Update breadcrumb

- [x] **4.4** Update `AuctionHistoryComponent`
  - [x] Read `auctionId` from route params
  - [x] Filter history by `auction_id`
  - [x] Update breadcrumb

- [x] **4.5** Create `AuctionSettingsComponent` (from `AuctionConfigComponent`)
  - [x] Read `auctionId` from route params
  - [x] Edit auction config (budget, player limits, name, description)
  - [x] Manage public slug / sharing settings
  - [x] Danger zone: Reset auction, Delete auction

---

### Phase 5: Player Pool & Auction Players (MEDIUM PRIORITY)
> Split the monolithic "My Players" into two distinct views

- [x] **5.1** Refactor `PlayersComponent` → `PlayerPoolComponent` (`/player-pool`)
  - [x] Rename component and route
  - [x] This is the global player catalog — CRUD, CSV import, search/filter
  - [x] No auction-specific state (no sold/unsold badges here)
  - [x] Add "Used in X auctions" count per player (nice-to-have)

- [x] **5.2** Create `AuctionPlayersComponent` (`/auction/:id/players`)
  - [x] List players added to *this* auction (from `auction_players` table)
  - [x] "Add from Pool" button → opens modal with global player list + checkboxes
  - [x] Batch add players to auction (creates `auction_players` records)
  - [x] Per-player: edit base price, remove from auction
  - [x] Status indicators: Available, Sold (with team name + price), Unsold, Skipped
  - [x] Bulk actions: Add all, Remove unsold, Reset statuses

---

### Phase 6: Deprecate AuctionContextService (MEDIUM PRIORITY)
> Remove the "selected auction" pattern in favor of route-based context

- [ ] **6.1** Audit all usages of `AuctionContextService`
  - [ ] List every component/service that injects it
  - [ ] Replace `currentAuctionId()` with route param reads
  - [ ] Replace `selectAuction()` calls with router navigation
  - [ ] Remove `localStorage` persistence of auction ID

- [ ] **6.2** Remove `AuctionSelectorComponent`
  - [ ] Remove from layout header
  - [ ] Delete component files

- [ ] **6.3** Remove `AuctionContextService`
  - [ ] Keep `createAuction()` and `deleteAuction()` methods — move to a simpler service or into `HomeComponent`
  - [ ] Delete service file

---

### Phase 7: UI Polish & Design System (LOW PRIORITY)
> Visual improvements across the redesigned app

- [ ] **7.1** Implement consistent breadcrumb navigation
  - [ ] Show: My Auctions > IPL 2026 > Teams
  - [ ] Clickable breadcrumb links

- [ ] **7.2** Add auction status transitions in UI
  - [ ] Draft → Active: "Start Auction" in overview + auction control
  - [ ] Active → Completed: "Complete Auction" button
  - [ ] Visual status indicators (color-coded headers)

- [ ] **7.3** Improve empty states
  - [ ] No auctions → "Create your first auction" with illustration
  - [ ] No teams in auction → "Add teams to get started"
  - [ ] No players in auction → "Add players from your pool"
  - [ ] No history → "Auction hasn't started yet"

- [ ] **7.4** Mobile-first responsive polish
  - [ ] Bottom navigation bar on mobile for auction workspace
  - [ ] Swipeable auction cards on home page
  - [ ] Touch-optimized auction control

- [ ] **7.5** Dark mode support
  - [ ] Theme variables for all components
  - [ ] Toggle in settings

- [ ] **7.6** Micro-animations
  - [ ] Card entrance animations on home page
  - [ ] Smooth page transitions within auction workspace
  - [ ] Sold player animation in auction control
  - [ ] Progress bar animations

---

### Phase 8: Public View Improvements (LOW PRIORITY)
> Improve the public auction sharing experience

- [ ] **8.1** Redesign public auction page
  - [ ] Professional read-only view of auction state
  - [ ] Live team standings with player lists
  - [ ] Budget visualization
  - [ ] Current player being auctioned (real-time)
  - [ ] QR code for sharing
  - [ ] No navigation sidebar — standalone page

---

## 📏 Migration Strategy

### Approach: **Parallel Routes** (Non-Breaking)

1. **Phase 1-2**: Add new routes alongside old ones. Old routes still work.
2. **Phase 3-5**: New components use new routes. Each page reads from route params.
3. **Phase 6**: Remove old routes and `AuctionContextService`. Add redirects.
4. **Phase 7-8**: Polish and optimizations.

### Backwards Compatibility:
- Old URLs (e.g., `/teams`) redirect to `/home` with a toast: "Navigation updated — select an auction to manage teams"
- `AuctionContextService` stays functional during migration (deprecated but not deleted until Phase 6)

---

## 🏗️ Data Flow Comparison

### Before (Current)
```
User logs in
  → Redirect to /dashboard
  → AuctionContextService auto-selects first auction (or last from localStorage)
  → User navigates to /teams → shows teams for "selected" auction
  → User changes auction via dropdown → same URL, different data 😕
```

### After (Proposed)
```
User logs in
  → Redirect to /home (My Auctions grid)
  → User clicks "IPL 2026" card
  → Navigate to /auction/abc-123/overview
  → Sidebar shows auction-scoped navigation
  → User clicks "Teams" → /auction/abc-123/teams
  → User clicks "Back to My Auctions" → /home
  → User clicks "Office League" → /auction/def-456/overview
  → URL always reflects exact context ✅
```

---

## 🎯 Success Criteria

| Metric | Target |
|--------|--------|
| **Auction context clarity** | User always knows which auction they're working in |
| **Zero ambiguity** | No page shows data from the "wrong" auction |
| **URL shareability** | Every meaningful state has a unique, bookmarkable URL |
| **Navigation depth** | ≤ 2 clicks from login to any auction sub-page |
| **Mobile usability** | Full functionality on mobile with ≤ 375px viewport |
| **Empty state guidance** | Every empty state has a clear CTA to guide the user |

---

## ⏱️ Estimated Timeline

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Routing & Layout | 3-4 days | 🔴 High |
| Phase 2: Home Page | 2-3 days | 🔴 High |
| Phase 3: Auction Overview | 2 days | 🔴 High |
| Phase 4: Scope Components | 3-4 days | 🟡 Medium |
| Phase 5: Player Pool Split | 2-3 days | 🟡 Medium |
| Phase 6: Deprecate Context | 1-2 days | 🟡 Medium |
| Phase 7: UI Polish | 3-5 days | 🟢 Low |
| Phase 8: Public View | 1-2 days | 🟢 Low |
| **Total** | **~17-23 days** | |

---

## 📝 Summary of Key Decisions

1. ✅ **Auction-centric navigation** — Navigate *into* auctions, not "select" them
2. ✅ **Keep Player Pool global** — Players are reusable templates, scoped into auctions via `auction_players`
3. ✅ **Remove AuctionSelectorComponent** — URL-based routing replaces the dropdown
4. ✅ **Two-mode sidebar** — Global mode (My Auctions, Pool) vs Auction Workspace mode
5. ✅ **Home page = Auction grid** — Merge Dashboard + Auctions list
6. ✅ **Team Roster stays** — But scoped per-auction, not reimagined
7. ✅ **Public view unchanged** — Already works with slugs
