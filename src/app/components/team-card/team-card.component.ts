import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Team } from '../../services/teams.service';

// Extended team interface for components that need players data
export interface TeamWithPlayers extends Team {
  players: any[];
}

export interface TeamCardConfig {
  showPlayers?: boolean;
  showActions?: boolean;
  showBudgetDetails?: boolean;
  showPlayerStats?: boolean;
  compact?: boolean;
  variant?: 'dashboard' | 'roster' | 'management';
}

@Component({
  selector: 'app-team-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './team-card.component.html',
  styleUrls: ['./team-card.component.css']
})
export class TeamCardComponent {
  @Input() team!: Team | TeamWithPlayers;
  @Input() config: TeamCardConfig = {
    showPlayers: false,
    showActions: false,
    showBudgetDetails: true,
    showPlayerStats: true,
    compact: false,
    variant: 'dashboard'
  };

  // Action events
  @Output() editTeam = new EventEmitter<Team | TeamWithPlayers>();
  @Output() toggleStatus = new EventEmitter<Team | TeamWithPlayers>();
  @Output() deleteTeam = new EventEmitter<Team | TeamWithPlayers>();
  @Output() viewTeam = new EventEmitter<Team | TeamWithPlayers>();

  // Computed values
  budgetPercentage = computed(() => {
    if (!this.team?.budget_cap) return 0;
    return (this.team.budget_spent / this.team.budget_cap) * 100;
  });

  playerPercentage = computed(() => {
    if (!this.team?.max_players) return 0;
    // Use players_count from Team interface or fallback to 0
    const playerCount = (this.team as any).players?.length || this.team.players_count || 0;
    return (playerCount / this.team.max_players) * 100;
  });

  budgetColor = computed(() => {
    const percentage = this.budgetPercentage();
    if (percentage > 80) return 'bg-red-500';
    if (percentage > 50) return 'bg-yellow-500';
    return 'bg-green-500';
  });

  playerColor = computed(() => {
    const percentage = this.playerPercentage();
    if (percentage >= 100) return 'bg-red-500';
    if (percentage > 80) return 'bg-yellow-500';
    return 'bg-green-500';
  });

  statusColor = computed(() => {
    if (!this.team?.is_active) return 'bg-red-100 text-red-800';
    
    const budgetUsed = this.budgetPercentage();
    if (budgetUsed > 80) return 'bg-yellow-100 text-yellow-800';
    if (budgetUsed > 50) return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800';
  });

  // Utility methods
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

  // Helper method to get player count
  getPlayerCount(): number {
    return (this.team as any).players?.length || this.team.players_count || 0;
  }

  // Helper method to get players array
  getPlayers(): any[] {
    return (this.team as any).players || [];
  }

  // Action handlers
  onEditTeam() {
    this.editTeam.emit(this.team);
  }

  onToggleStatus() {
    this.toggleStatus.emit(this.team);
  }

  onDeleteTeam() {
    this.deleteTeam.emit(this.team);
  }

  onViewTeam() {
    this.viewTeam.emit(this.team);
  }
} 