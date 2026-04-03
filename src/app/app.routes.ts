import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { TeamsComponent } from './components/teams/teams.component';
import { PlayersComponent } from './components/players/players.component';
import { TeamRosterComponent } from './components/team-roster/team-roster.component';
import { LayoutComponent } from './components/layout/layout.component';
import { AuctionControlComponent } from './components/auction-control/auction-control.component';
import { AuctionConfigComponent } from './components/auction-config/auction-config.component';
import { AuctionHistoryComponent } from './components/auction-history/auction-history.component';
import { AuthCallbackComponent } from './components/auth-callback/auth-callback.component';
import { UserManagementComponent } from './components/user-management/user-management.component';
import { AuctionsComponent } from './components/auctions/auctions.component';
import { PublicAuctionComponent } from './components/public-auction/public-auction.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
  { path: 'view/:slug', component: PublicAuctionComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'auctions', component: AuctionsComponent },
      { path: 'teams', component: TeamsComponent },
      { path: 'players', component: PlayersComponent },
      { path: 'team-roster', component: TeamRosterComponent },
      { path: 'auction-config', component: AuctionConfigComponent },
      { path: 'auction-control', component: AuctionControlComponent },
      { path: 'auction', component: AuctionControlComponent },
      { path: 'auction-history', component: AuctionHistoryComponent },
      { path: 'user-management', component: UserManagementComponent, canActivate: [adminGuard] },
      { path: 'analytics', component: DashboardComponent },
      { path: 'settings', component: DashboardComponent },
    ]
  },
  // Add more routes here as needed
];
