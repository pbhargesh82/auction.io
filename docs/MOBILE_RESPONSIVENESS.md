# Mobile Responsiveness Tracking

This document tracks the progress of making the Auction.io application fully mobile-responsive.

> [!IMPORTANT]
> **Core Mandate**: Any changes made to introduce mobile responsiveness MUST NOT affect the web/desktop version of the application. The desktop experience must remain intact, utilizing existing grid layouts and structures. Use Tailwind's responsive prefixes (e.g., `sm:`, `md:`, `lg:`) to apply mobile-specific layout changes exclusively to smaller viewports.

## Viewport scroll contract (2026-07-23)

- `html` / `body` / `app-root`: fill height, **no document scroll**.
- Layout + workspace shells: `h-dvh` + `overflow-hidden`; `<main>` is `flex-1 min-h-0 overflow-hidden`.
- **Option A pages** (Home, Overview, Control, Settings, Rosters): page root `h-full min-h-0 overflow-y-auto` — one scroller inside the shell.
- **List / table pages** (Player Pool reference, User Management, Teams, Auction Players, History): page root `overflow-hidden`; panel `flex-1 min-h-0` + `overflow-auto` / mobile cards `overflow-y-auto`.
- **Login / Public**: `h-dvh max-h-dvh` with internal `overflow-y-auto` (outside app shells).

## Progress Checklist

### Authentication & Public Hub
- [x] **Login Component** (`login`) — short-viewport scroll fixed; live QA pass
- [x] **Home/Workspace Select** (`home`) — Option A + host fill; live QA pass

### The Workspace Shell
- [x] **App Layout Wrapper** (`layout`, `auction-workspace-layout`) — `h-dvh` shells; children fill `main`

### Admin Management Modules
- [x] **Teams Dashboard** (`teams`) — Player Pool pattern; live QA pass
- [x] **Team Roster** (`team-roster`) — Option A; live QA pass
- [x] **Player Pool / Auction Players** (`players`, `auction-players`) — reference / aligned; live QA pass
- [x] **User Management** (`user-management`) — Player Pool pattern; live QA pass
- [x] **Auction Settings** (`auction-settings`) — Option A; live QA pass

### Live Operations
- [x] **Auction Control Desk** (`auction-control`) — Option A; live QA pass
- [x] **Auction History** (`auction-history`) — Player Pool pattern; live QA pass
- [x] **Auction Overview** (`auction-overview`) — Option A; live QA pass

### Public Views
- [x] **Public Broadcast View** (`public-auction`) — `h-dvh` + internal main scroll; live QA pass

## Live QA matrix (2026-07-23, 390×844, localhost:4200)

| Route | Pattern | Body scroll | Result |
|-------|---------|-------------|--------|
| `/login` | page `h-dvh` scroll | no | Pass |
| `/home` | Option A | no | Pass |
| `/player-pool` | list/panel (baseline) | no | Pass — mobile cards scroll |
| `/user-management` | list/panel | no | Pass |
| `/auction/:id/overview` | Option A | no | Pass |
| `/auction/:id/teams` | list/panel | no | Pass |
| `/auction/:id/players` | list/panel | no | Pass |
| `/auction/:id/control` | Option A | no | Pass |
| `/auction/:id/rosters` | Option A | no | Pass |
| `/auction/:id/history` | list/panel | no | Pass |
| `/auction/:id/settings` | Option A | no | Pass |
| `/view/super-admin-test-auc-a83ee179` | `h-dvh` + main scroll | no | Pass |

Destructive control actions (sell/unsold/reset) skipped — no QA Sandbox designated.

## Mobile UI cleanup pass (2026-07-27, 390x844, localhost:4200)

- `auction-control`
  - Removed duplicate inner `Auction Desk` title and tightened the status card spacing.
  - Verified `Sell Player` side panel opens at a narrow mobile width instead of taking over the full screen.
  - Verified backdrop dismissal on mobile and confirmed the close control remains in the panel header.
- `auction-players`
  - Reduced the mobile action bar to search + `Add from Pool`.
  - Removed the non-functional `Drop Unsold` and `Reset` actions.
  - Gated `Add from Pool` to the auction owner by `auction.owner_id === currentUser.id`.
- `auction-history`
  - Removed the `Revenue` stat and collapsed stats to a 3-column mobile row (`Total`, `Sold`, `Unsold`).
- `team-roster`
  - Removed the duplicate `League Rosters` page header and kept the workspace label as the single title source.
- `auction-settings`
  - Removed the duplicate page title/subtitle header and kept the workspace label plus settings sections.
- `user-profile`
  - Removed the chevron and simplified the avatar button styling for a cleaner mobile header control.

### Targeted QA notes

- `/auction/:id/control` — Pass: no body scroll; duplicate title removed; sell panel width measured at ~359px on a 390px viewport; backdrop dismiss works.
- `/auction/:id/players` — Pass: only search + add action remains; `Drop Unsold` and `Reset` are absent.
- `/auction/:id/history` — Pass: no `Revenue` stat; stat grid resolves to 3 mobile columns.
- `/auction/:id/rosters` — Pass: duplicate `League Rosters` title removed.
- `/auction/:id/settings` — Pass: duplicate settings subtitle block removed; page sections remain intact.
- Workspace header avatar — Pass: mobile header shows a clean avatar control without the old chevron/pill look.

## Mobile UI cleanup pass (2026-07-29, 390x844, localhost:4200)

- `teams`
  - Fixed Manage Teams search: added `min-w-0`, shortened placeholder to `Search teams...`, ensured icon visibility.
  - Migrated Add/Edit Team form from inline full-bleed panel to shared `app-side-panel`.
- `auction-control`
  - Removed redundant in-page Status block (status remains in workspace header).
  - Verified `Sell Player` uses shared side panel on mobile.
- `players`
  - Migrated Add/Edit Player form from inline panel to shared `app-side-panel` (consistent mobile floating card).
- `shared/side-panel`
  - Unified mobile behavior: `z-[200]`, `mt-20` below workspace header, `w-[92vw]`, rounded card, safe-area top padding on header.
- `public-auction`
  - Scaled down hero player card on mobile (smaller portrait, typography, padding, badge); reduced aside `min-h` on mobile.

### Targeted QA notes (2026-07-29)

- `/auction/:id/teams` — Pass: search icon + short placeholder; Add Team opens floating side panel with form fields.
- `/player-pool` — Pass: Add Player opens shared side panel on mobile (not full-screen dialog).
- `/auction/:id/control` — Pass: no in-page Status block; Sell Player panel opens with form fields.
- `/view/super-admin-test-auc-a83ee179` — Pass: player card fits iPhone 15 Pro width; Team Standings visible below without excessive scroll.

## Guidelines for Refactoring

1. **Mobile-First Approach**: Write base Tailwind classes for mobile devices (e.g., stacking elements vertically), and use breakpoints like `lg:` to lock in the complex desktop layouts.
2. **Hidden Tables, Visible Cards**: For data tables, use `hidden sm:block` / `hidden md:block` for the desktop view, and build a mobile-friendly card list for smaller viewports.
3. **Responsive Action Bars**: Use flex-col wrapping (`flex-col sm:flex-row`) for search inputs and buttons within action bars so they stack elegantly on small screens.
4. **Host height**: Shell children should use `host: { class: 'block h-full w-full min-h-0' }` so `h-full` resolves under Angular hosts.
