import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { TeamsComponent } from './components/teams/teams.component';
import { PlayersComponent } from './components/players/players.component';
import { TeamRosterComponent } from './components/team-roster/team-roster.component';
import { LayoutComponent } from './components/layout/layout.component';
import { AuctionControlComponent } from './components/auction-control/auction-control.component';
import { AuctionConfigComponent } from './components/auction-config/auction-config.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'teams', component: TeamsComponent },
      { path: 'players', component: PlayersComponent },
      { path: 'team-roster', component: TeamRosterComponent },
      { path: 'auction-config', component: AuctionConfigComponent },
      { path: 'auction-control', component: AuctionControlComponent },
      { path: 'auction', component: AuctionControlComponent }, // Default auction route
      { path: 'analytics', component: DashboardComponent }, // Placeholder - will be replaced with AnalyticsComponent
      { path: 'settings', component: DashboardComponent }, // Placeholder - will be replaced with SettingsComponent
    ]
  },
  // Add more routes here as needed
];
