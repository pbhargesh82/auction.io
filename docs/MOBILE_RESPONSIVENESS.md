# Mobile Responsiveness Tracking

This document tracks the progress of making the Auction.io application fully mobile-responsive.

> [!IMPORTANT]
> **Core Mandate**: Any changes made to introduce mobile responsiveness MUST NOT affect the web/desktop version of the application. The desktop experience must remain intact, utilizing existing grid layouts and structures. Use Tailwind's responsive prefixes (e.g., `sm:`, `md:`, `lg:`) to apply mobile-specific layout changes exclusively to smaller viewports.

## Progress Checklist

### Authentication & Public Hub
- [x] **Login Component** (`login`)
- [x] **Home/Workspace Select** (`home`)

### The Workspace Shell
- [x] **App Layout Wrapper** (`auction-workspace-layout`)

### Admin Management Modules
- [ ] **Teams Dashboard** (`teams`)
- [ ] **Team Roster** (`team-roster`)
- [x] **Player Pool / Auction Players** (`players`, `auction-players`)
- [x] **User Management** (`user-management`)
- [ ] **Auction Settings** (`auction-settings`)

### Live Operations
- [ ] **Auction Control Desk** (`auction-control`)
- [ ] **Auction History** (`auction-history`)
- [ ] **Auction Overview** (`auction-overview`)

### Public Views
- [x] **Public Broadcast View** (`public-auction`)

## Guidelines for Refactoring

1. **Mobile-First Approach**: Write base Tailwind classes for mobile devices (e.g., stacking elements vertically), and use breakpoints like `lg:` to lock in the complex desktop layouts.
2. **Hidden Tables, Visible Cards**: For data tables, use `hidden md:table` for the desktop view, and build a mobile-friendly card list wrapped in `md:hidden` for mobile viewports.
3. **Responsive Action Bars**: Use flex-col wrapping (`flex-col sm:flex-row`) for search inputs and buttons within action bars so they stack elegantly on small screens.
