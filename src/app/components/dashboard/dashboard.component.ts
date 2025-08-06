import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService, UserRole } from '../../services/supabase.service';
import { AuctionStateService, TeamWithPlayers } from '../../services/auction-state.service';
import { MatIconModule } from '@angular/material/icon';
import { TeamCardComponent } from '../team-card/team-card.component';

interface PlayerStats {
  totalPlayers: number;
  soldPlayers: number;
  availablePlayers: number;
  totalBasePrice: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, TeamCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  // Use centralized state service
  teamsWithPlayers;
  loading;
  error;
  user = signal<any>(null);
  userRole = signal<UserRole>('user');

  // Computed signals
  welcomeMessage = computed(() => {
    const currentUser = this.user();
    if (currentUser?.email) {
      const name = currentUser.email.split('@')[0];
      return `Welcome back, ${name}!`;
    }
    return 'Welcome to your dashboard!';
  });

  // Computed signal for admin status
  isAdmin = computed(() => this.userRole() === 'admin');

  playerStats = computed((): PlayerStats => {
    const allPlayers = this.auctionStateService.players();
    const soldPlayers = this.auctionStateService.soldPlayers();
    const availablePlayers = this.auctionStateService.availablePlayers();
    
    return {
      totalPlayers: allPlayers.length,
      soldPlayers: soldPlayers.length,
      availablePlayers: availablePlayers.length,
      totalBasePrice: allPlayers.reduce((sum, p) => sum + p.base_price, 0)
    };
  });

  totalBudgetSpent = computed(() => 
    this.teamsWithPlayers().reduce((sum, team) => sum + team.budget_spent, 0)
  );

  totalBudgetRemaining = computed(() => 
    this.teamsWithPlayers().reduce((sum, team) => sum + (team.budget_cap - team.budget_spent), 0)
  );

  totalBudgetCap = computed(() =>
    this.teamsWithPlayers().reduce((sum, team) => sum + team.budget_cap, 0)
  );

  constructor(
    private supabaseService: SupabaseService,
    private auctionStateService: AuctionStateService,
    private router: Router
  ) {
    this.teamsWithPlayers = this.auctionStateService.teamsWithPlayers;
    this.loading = this.auctionStateService.loading;
    this.error = this.auctionStateService.error;

    this.supabaseService.userRole.subscribe(role => {
      this.userRole.set(role);
    });
  }

  async ngOnInit() {
    await this.loadDashboardData();
  }

  async refreshData() {
    await this.loadDashboardData();
  }

  private async loadDashboardData() {
    try {
      // Get current user
      const currentUser = this.supabaseService.currentUserValue;
      if (!currentUser) {
        this.router.navigate(['/login']);
        return;
      }

      // Load all data using centralized service
      await this.auctionStateService.loadAllData();

    } catch (error: any) {
      console.error('Dashboard error:', error);
    }
  }

  navigateToTeams() {
    this.router.navigate(['/teams']);
  }

  navigateToPlayers() {
    this.router.navigate(['/players']);
  }

  navigateToAuctionConfig() {
    this.router.navigate(['/auction-config']);
  }

  startAuction() {
    // Check if we have teams and players configured
    const teamsCount = this.teamsWithPlayers().length;
    const playersCount = this.auctionStateService.players().length;
    
    if (teamsCount === 0) {
      alert('Please configure teams first before starting the auction.');
      this.router.navigate(['/teams']);
      return;
    }
    
    if (playersCount === 0) {
      alert('Please add players first before starting the auction.');
      this.router.navigate(['/players']);
      return;
    }
    

    this.router.navigate(['/auction-control']);
  }

  getBudgetPercentage(team: TeamWithPlayers): number {
    if (team.budget_cap === 0) return 0;
    return Math.round((team.budget_spent / team.budget_cap) * 100);
  }

  getTeamStatusColor(team: TeamWithPlayers): string {
    if (!team.is_active) return 'bg-red-100 text-red-800';
    
    const budgetUsed = this.getBudgetPercentage(team);
    if (budgetUsed > 80) return 'bg-yellow-100 text-yellow-800';
    if (budgetUsed > 50) return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800';
  }

  getPlayerStatusColor(player: any): string {
    if (player.is_sold) return 'bg-green-100 text-green-800';
    if (!player.is_active) return 'bg-red-100 text-red-800';
    return 'bg-blue-100 text-blue-800';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('en-IN').format(num);
  }
} 