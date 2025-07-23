import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuctionStateService, TeamWithPlayers } from '../../services/auction-state.service';

@Component({
  selector: 'app-team-roster',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './team-roster.component.html',
  styleUrls: ['./team-roster.component.css']
})
export class TeamRosterComponent implements OnInit {
  // Use centralized state service
  teamsWithPlayers;
  loading;
  error;

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
          purchased_at: tp.purchased_at
        }))
        .filter(player => player !== null && player !== undefined) || []
    }));
  });

  constructor(
    private auctionStateService: AuctionStateService
  ) {
    this.teamsWithPlayers = this.auctionStateService.teamsWithPlayers;
    this.loading = this.auctionStateService.loading;
    this.error = this.auctionStateService.error;
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