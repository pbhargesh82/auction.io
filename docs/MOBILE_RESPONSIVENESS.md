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

## Guidelines for Refactoring

1. **Mobile-First Approach**: Write base Tailwind classes for mobile devices (e.g., stacking elements vertically), and use breakpoints like `lg:` to lock in the complex desktop layouts.
2. **Hidden Tables, Visible Cards**: For data tables, use `hidden sm:block` / `hidden md:block` for the desktop view, and build a mobile-friendly card list for smaller viewports.
3. **Responsive Action Bars**: Use flex-col wrapping (`flex-col sm:flex-row`) for search inputs and buttons within action bars so they stack elegantly on small screens.
4. **Host height**: Shell children should use `host: { class: 'block h-full w-full min-h-0' }` so `h-full` resolves under Angular hosts.
