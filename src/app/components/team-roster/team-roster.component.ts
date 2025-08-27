import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuctionStateService, TeamWithPlayers } from '../../services/auction-state.service';
import { TeamCardComponent } from '../team-card/team-card.component';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-team-roster',
  standalone: true,
  imports: [CommonModule, TeamCardComponent],
  templateUrl: './team-roster.component.html',
  styleUrls: ['./team-roster.component.css']
})
export class TeamRosterComponent implements OnInit {
  // Use centralized state service
  teamsWithPlayers;
  loading;
  error;

  // Admin role signal
  isAdmin = signal(false);

  // Fallback computed value for debugging
  teamsWithPlayersDebug = computed(() => {
    const teams = this.auctionStateService.teams();
    const teamPlayers = this.auctionStateService.teamPlayers();
    
    console.log('🔍 Debug computed value:');
    console.log('Teams:', teams);
    console.log('Team players:', teamPlayers);
    
    return teams.map(team => ({
      ...team,
      players: teamPlayers
        .filter(tp => tp.team_id === team.id)
        .map(tp => ({
          ...tp.player,
          purchase_price: tp.purchase_price,
          purchased_at: tp.purchased_at,
          team_player_id: tp.id // Add team_player_id for sell-back functionality
        }))
        .filter(player => player !== null && player !== undefined) || []
    }));
  });

  constructor(
    private auctionStateService: AuctionStateService,
    private supabaseService: SupabaseService
  ) {
    this.teamsWithPlayers = this.auctionStateService.teamsWithPlayers;
    this.loading = this.auctionStateService.loading;
    this.error = this.auctionStateService.error;

    // Subscribe to admin role changes
    this.supabaseService.isAdmin.subscribe(isAdmin => {
      this.isAdmin.set(isAdmin);
    });
  }

  async ngOnInit() {
    await this.auctionStateService.loadAllData();
    
    // Debug logging
    console.log('🔍 Team Roster Debug Info:');
    console.log('Teams with players:', this.teamsWithPlayers());
    console.log('Loading state:', this.loading());
    console.log('Error state:', this.error());
  }

  async refreshData() {
    await this.auctionStateService.loadAllData();
  }

  // Handle player sold back event
  async onPlayerSoldBack(event: {teamId: string, playerId: string, refundAmount: number}) {
    console.log('Player sold back:', event);
    
    // Refresh data to show updated team budgets and player lists
    await this.auctionStateService.loadAllData();
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