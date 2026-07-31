import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { AuctionStateService } from '../../services/auction-state.service';
import { TeamPlayersService } from '../../services/team-players.service';
import { SupabaseService } from '../../services/supabase.service';
import { AvatarComponent } from '../shared/avatar/avatar.component';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-team-roster',
  standalone: true,
  imports: [CommonModule, AvatarComponent],
  templateUrl: './team-roster.component.html',
  styleUrls: ['./team-roster.component.css'],
  host: { class: 'block h-full w-full min-h-0' }
})
export class TeamRosterComponent implements OnInit {
  // Use centralized state service
  loading;
  error;

  // Admin role signal
  isAdmin = signal(false);

  // Selling state for UX
  sellingPlayer = signal<string | null>(null);

  // All Teams with their Rosters
  teamsWithRosters = computed(() => {
    const teams = this.auctionStateService.teams();
    const teamPlayers = this.auctionStateService.teamPlayers();
    
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
    private teamPlayersService: TeamPlayersService,
    private supabaseService: SupabaseService,
    private route: ActivatedRoute,
    private toast: ToastService,
  ) {
    this.loading = this.auctionStateService.loading;
    this.error = this.auctionStateService.error;

    // Subscribe to admin role changes
    this.supabaseService.isAdmin.subscribe(isAdmin => {
      this.isAdmin.set(isAdmin);
    });
  }

  async ngOnInit() {
    await this.auctionStateService.loadAllData(this.auctionId());
  }

  // Resolve the auction :id from the route param tree
  private auctionId(): string {
    let r: ActivatedRoute | null = this.route;
    while (r) {
      const id = r.snapshot.paramMap.get('id');
      if (id) return id;
      r = r.parent;
    }
    return '';
  }

  // Sell player back to auction pool
  async sellPlayerBack(player: any, teamName: string) {
    if (!player.team_player_id) {
      this.toast.error('Player data is incomplete');
      return;
    }

    // Show confirmation dialog
    const confirmed = confirm(
      `Are you sure you want to sell ${player.name} back to the auction pool?\n\n` +
      `This will:\n` +
      `• Remove the player from ${teamName}\n` +
      `• Refund ₹${this.formatNumber(player.purchase_price)} to the team budget\n` +
      `• Make the player available for auction again\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    this.sellingPlayer.set(player.id);

    try {
      const { error } = await this.teamPlayersService.sellPlayerBackToPool(player.team_player_id);

      if (error) {
        throw error;
      }

      this.toast.success(`Successfully sold ${player.name} back to auction pool. Refunded ₹${this.formatNumber(player.purchase_price)}.`);

      // Refresh data to show updated team budgets and player lists
      await this.auctionStateService.loadAllData(this.auctionId());

    } catch (error: any) {
      this.toast.error(`Error: ${error.message}`);
    } finally {
      this.sellingPlayer.set(null);
    }
  }

  // Check if player is currently being sold back
  isSellingPlayer(playerId: string): boolean {
    return this.sellingPlayer() === playerId;
  }

  // Budget calculations
  getBudgetPercentage(spent: number, cap: number): number {
    if (!cap) return 0;
    return (spent / cap) * 100;
  }

  getPlayerPercentage(count: number, max: number): number {
    if (!max) return 0;
    return (count / max) * 100;
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('en-IN').format(num);
  }
}