import { Routes } from '@angular/router';

import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { auctionWorkspaceGuard } from './guards/auction-workspace.guard';

export const routes: Routes = [
  // ── Public / Unauthenticated ────────────────────────────────────────────────
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./components/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent)
  },
  {
    path: 'view/:slug',
    loadComponent: () =>
      import('./components/public-auction/public-auction.component').then(m => m.PublicAuctionComponent)
  },

  // ── Global Layout Shell (global pages) ─────────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./components/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./components/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'player-pool',
        loadComponent: () =>
          import('./components/players/players.component').then(m => m.PlayersComponent)
      },
      {
        path: 'user-management',
        loadComponent: () =>
          import('./components/user-management/user-management.component').then(m => m.UserManagementComponent),
        canActivate: [adminGuard]
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./components/account-settings/account-settings.component').then(m => m.AccountSettingsComponent)
      },

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
  {
    path: 'auction/:id',
    loadComponent: () =>
      import('./components/auction-workspace-layout/auction-workspace-layout.component').then(
        m => m.AuctionWorkspaceLayoutComponent
      ),
    canActivate: [authGuard, auctionWorkspaceGuard],
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./components/auction-overview/auction-overview.component').then(m => m.AuctionOverviewComponent)
      },
      {
        path: 'teams',
        loadComponent: () =>
          import('./components/teams/teams.component').then(m => m.TeamsComponent)
      },
      {
        path: 'players',
        loadComponent: () =>
          import('./components/auction-players/auction-players.component').then(m => m.AuctionPlayersComponent)
      },
      {
        path: 'control',
        loadComponent: () =>
          import('./components/auction-control/auction-control.component').then(m => m.AuctionControlComponent)
      },
      {
        path: 'rosters',
        loadComponent: () =>
          import('./components/team-roster/team-roster.component').then(m => m.TeamRosterComponent)
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./components/auction-history/auction-history.component').then(m => m.AuctionHistoryComponent)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./components/auction-settings/auction-settings.component').then(m => m.AuctionSettingsComponent)
      },
    ]
  },

  // ── Catch-all ───────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '/home' },
];
