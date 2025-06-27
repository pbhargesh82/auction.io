import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TeamsService, Team } from '../../services/teams.service';
import { PlayersService, Player } from '../../services/players.service';

interface TeamWithPlayers extends Team {
  players: Player[];
}

@Component({
  selector: 'app-team-roster',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './team-roster.component.html',
  styleUrls: ['./team-roster.component.css']
})
export class TeamRosterComponent implements OnInit {
  // Signals for reactive state management
  loading = signal(true);
  teams = signal<TeamWithPlayers[]>([]);
  selectedTeam = signal<TeamWithPlayers | null>(null);
  dropdownOpen = signal(false);
  error = signal<string | null>(null);

  // Computed signals
  selectedTeamStats = computed(() => {
    const team = this.selectedTeam();
    if (!team) return null;
    
    return {
      totalPlayers: team.players.length,
      soldPlayers: team.players.filter(p => p.is_sold).length,
      availablePlayers: team.players.filter(p => !p.is_sold && p.is_active).length,
      openSpots: team.max_players - team.players.length,
      budgetUsed: team.budget_spent,
      budgetRemaining: team.budget_cap - team.budget_spent,
      budgetPercentage: team.budget_cap > 0 ? Math.round((team.budget_spent / team.budget_cap) * 100) : 0
    };
  });

  constructor(
    private teamsService: TeamsService,
    private playersService: PlayersService
  ) {}

  async ngOnInit() {
    await this.loadData();
  }

  private async loadData() {
    this.loading.set(true);
    this.error.set(null);

    try {
      // Load teams
      const { data: teamsData, error: teamsError } = await this.teamsService.getTeams();
      if (teamsError) throw teamsError;

      // Load players
      const { data: playersData, error: playersError } = await this.playersService.getPlayers();
      if (playersError) throw playersError;

      // Group players by team (simulated assignment)
      const teamsWithPlayers: TeamWithPlayers[] = (teamsData || []).map((team, index) => {
        const teamPlayers = (playersData || []).filter((_, playerIndex) => 
          playerIndex % (teamsData?.length || 1) === index
        );
        
        return {
          ...team,
          players: teamPlayers
        };
      });

      this.teams.set(teamsWithPlayers);
      
      // Select first team by default
      if (teamsWithPlayers.length > 0) {
        this.selectedTeam.set(teamsWithPlayers[0]);
      }

    } catch (error: any) {
      this.error.set('Failed to load team data. Please try again.');
      console.error('Team roster error:', error);
    } finally {
      this.loading.set(false);
    }
  }

  selectTeam(team: TeamWithPlayers) {
    this.selectedTeam.set(team);
    this.dropdownOpen.set(false);
  }

  toggleDropdown() {
    this.dropdownOpen.update(open => !open);
  }

  closeDropdown() {
    this.dropdownOpen.set(false);
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

  getPlayerStatusColor(player: Player): string {
    if (player.is_sold) return 'bg-green-100 text-green-800';
    if (!player.is_active) return 'bg-red-100 text-red-800';
    return 'bg-blue-100 text-blue-800';
  }

  getPlayerStatusText(player: Player): string {
    if (player.is_sold) return 'Sold';
    if (!player.is_active) return 'Inactive';
    return 'Available';
  }
} 