import { Routes } from '@angular/router';

// ── Auth / Public ─────────────────────────────────────────────────────────────
import { LoginComponent } from './components/login/login.component';
import { AuthCallbackComponent } from './components/auth-callback/auth-callback.component';
import { PublicAuctionComponent } from './components/public-auction/public-auction.component';

// ── Layouts ───────────────────────────────────────────────────────────────────
import { LayoutComponent } from './components/layout/layout.component';
import { AuctionWorkspaceLayoutComponent } from './components/auction-workspace-layout/auction-workspace-layout.component';

// ── Global pages ──────────────────────────────────────────────────────────────
import { HomeComponent } from './components/home/home.component';
import { PlayerPoolComponent } from './components/player-pool/player-pool.component';
import { UserManagementComponent } from './components/user-management/user-management.component';

// ── Auction Workspace pages ───────────────────────────────────────────────────
import { AuctionOverviewComponent } from './components/auction-overview/auction-overview.component';
import { TeamsComponent } from './components/teams/teams.component';
import { AuctionPlayersComponent } from './components/auction-players/auction-players.component';
import { AuctionControlComponent } from './components/auction-control/auction-control.component';
import { TeamRosterComponent } from './components/team-roster/team-roster.component';
import { AuctionHistoryComponent } from './components/auction-history/auction-history.component';
import { AuctionSettingsComponent } from './components/auction-settings/auction-settings.component';

// ── Guards ────────────────────────────────────────────────────────────────────
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { auctionWorkspaceGuard } from './guards/auction-workspace.guard';

export const routes: Routes = [
  // ── Public / Unauthenticated ────────────────────────────────────────────────
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
  { path: 'view/:slug', component: PublicAuctionComponent },

  // ── Global Layout Shell (global pages) ─────────────────────────────────────
  // Renders the flat global sidebar (My Auctions, Player Pool, Settings…)
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'home',            component: HomeComponent },
      { path: 'player-pool',     component: PlayerPoolComponent },
      { path: 'user-management', component: UserManagementComponent, canActivate: [adminGuard] },
      { path: 'settings',        redirectTo: '/home', pathMatch: 'full' }, // Phase 7

      // Backwards-compatibility redirects (old flat routes → /home or /player-pool)
      { path: 'dashboard',       redirectTo: '/home',        pathMatch: 'full' },
      { path: 'auctions',        redirectTo: '/home',        pathMatch: 'full' },
      { path: 'teams',           redirectTo: '/home',        pathMatch: 'full' },
      { path: 'players',         redirectTo: '/player-pool', pathMatch: 'full' },
      { path: 'team-roster',     redirectTo: '/home',        pathMatch: 'full' },
      { path: 'auction-control', redirectTo: '/home',        pathMatch: 'full' },
      { path: 'auction-history', redirectTo: '/home',        pathMatch: 'full' },
      { path: 'auction-config',  redirectTo: '/home',        pathMatch: 'full' },
      { path: 'analytics',       redirectTo: '/home',        pathMatch: 'full' },
      { path: 'auction',         redirectTo: '/home',        pathMatch: 'full' },
    ]
  },

  // ── Auction Workspace Shell ─────────────────────────────────────────────────
  // Separate layout shell — renders auction-scoped sidebar with Back button,
  // auction name/status, and per-auction nav. Lives alongside LayoutComponent,
  // NOT nested inside it, so only one sidebar is ever visible at once.
  {
    path: 'auction/:id',
    component: AuctionWorkspaceLayoutComponent,
    canActivate: [authGuard, auctionWorkspaceGuard],
    children: [
      { path: '',         redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', component: AuctionOverviewComponent },
      { path: 'teams',    component: TeamsComponent },
      { path: 'players',  component: AuctionPlayersComponent },
      { path: 'control',  component: AuctionControlComponent },
      { path: 'rosters',  component: TeamRosterComponent },
      { path: 'history',  component: AuctionHistoryComponent },
      { path: 'settings', component: AuctionSettingsComponent },
    ]
  },

  // ── Catch-all ───────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '/home' },
];

