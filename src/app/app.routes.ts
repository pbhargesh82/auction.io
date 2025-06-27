import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { TeamsComponent } from './components/teams/teams.component';
import { LayoutComponent } from './components/layout/layout.component';
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
      { path: 'players', component: DashboardComponent }, // Placeholder - will be replaced with PlayersComponent
      { path: 'auction', component: DashboardComponent }, // Placeholder - will be replaced with AuctionComponent
      { path: 'analytics', component: DashboardComponent }, // Placeholder - will be replaced with AnalyticsComponent
      { path: 'settings', component: DashboardComponent }, // Placeholder - will be replaced with SettingsComponent
    ]
  },
  // Add more routes here as needed
];
