import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { TeamsService, Team } from '../../services/teams.service';
import { PlayersService, Player } from '../../services/players.service';

interface PlayerStats {
  totalPlayers: number;
  soldPlayers: number;
  availablePlayers: number;
  totalBasePrice: number;
}

interface TeamWithPlayers extends Team {
  players: Player[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  // Signals for reactive state management
  loading = signal(true);
  user = signal<any>(null);
  teams = signal<TeamWithPlayers[]>([]);
  players = signal<Player[]>([]);
  error = signal<string | null>(null);

  // Computed signals
  welcomeMessage = computed(() => {
    const currentUser = this.user();
    if (currentUser?.email) {
      const name = currentUser.email.split('@')[0];
      return `Welcome back, ${name}!`;
    }
    return 'Welcome to your dashboard!';
  });

  playerStats = computed((): PlayerStats => {
    const allPlayers = this.players();
    const playersOnTeams = this.teams().reduce((sum, team) => sum + team.players.length, 0);
    const soldPlayers = allPlayers.filter(p => p.is_sold).length;
    const availablePlayers = Math.max(0, allPlayers.length - playersOnTeams);
    
    return {
      totalPlayers: allPlayers.length,
      soldPlayers: soldPlayers,
      availablePlayers: availablePlayers,
      totalBasePrice: allPlayers.reduce((sum, p) => sum + p.base_price, 0)
    };
  });

  totalBudgetSpent = computed(() => 
    this.teams().reduce((sum, team) => sum + team.budget_spent, 0)
  );

  totalBudgetRemaining = computed(() => 
    this.teams().reduce((sum, team) => sum + (team.budget_cap - team.budget_spent), 0)
  );

  totalBudgetCap = computed(() =>
    this.teams().reduce((sum, team) => sum + team.budget_cap, 0)
  );

  constructor(
    private supabaseService: SupabaseService,
    private teamsService: TeamsService,
    private playersService: PlayersService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadDashboardData();
  }

  private async loadDashboardData() {
    this.loading.set(true);
    this.error.set(null);

    try {
      // Get current user
      const currentUser = this.supabaseService.currentUserValue;
      if (!currentUser) {
        this.router.navigate(['/login']);
        return;
      }
      
      this.user.set(currentUser);

      // Load teams and players data
      await this.loadTeamsData();
      await this.loadPlayersData();

    } catch (error: any) {
      this.error.set('Failed to load dashboard data. Please try again.');
      console.error('Dashboard error:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadTeamsData() {
    const { data: teamsData, error: teamsError } = await this.teamsService.getTeams();
    if (teamsError) {
      console.error('Error loading teams:', teamsError);
      return;
    }

    // Initialize teams with empty players arrays
    const teamsWithPlayers: TeamWithPlayers[] = (teamsData || []).map(team => ({
      ...team,
      players: []
    }));

    this.teams.set(teamsWithPlayers);
  }

  private async loadPlayersData() {
    const { data: playersData, error: playersError } = await this.playersService.getPlayers();
    if (playersError) {
      console.error('Error loading players:', playersError);
      return;
    }

    this.players.set(playersData || []);

    // Group players by team (for now, we'll simulate team assignments)
    // In a real app, you'd have a team_id field in the players table
    this.assignPlayersToTeams(playersData || []);
  }

  private assignPlayersToTeams(players: Player[]) {
    const teams = this.teams();
    if (teams.length === 0) return;

    // Simulate player assignments - distribute players among teams
    const updatedTeams = teams.map((team, index) => {
      const teamPlayers = players.filter((_, playerIndex) => 
        playerIndex % teams.length === index
      );
      
      return {
        ...team,
        players: teamPlayers,
        // Update budget spent based on assigned players
        budget_spent: teamPlayers
          .filter(p => p.is_sold)
          .reduce((sum, p) => sum + p.base_price, 0)
      };
    });

    this.teams.set(updatedTeams);
  }

  navigateToTeams() {
    this.router.navigate(['/teams']);
  }

  navigateToPlayers() {
    this.router.navigate(['/players']);
  }

  startAuction() {
    // Navigate to auction page (to be implemented)
    // For now, show a confirmation dialog
    if (confirm('Are you ready to start the auction? Make sure all teams and players are configured properly.')) {
      // TODO: Navigate to auction control panel
      alert('Auction feature coming soon! This will redirect to the auction control panel.');
    }
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

  getPlayerStatusColor(player: Player): string {
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