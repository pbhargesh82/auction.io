import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { SidePanelComponent } from '../shared/side-panel/side-panel.component';
import { AvatarComponent } from '../shared/avatar/avatar.component';

import { AuctionService, AuctionConfig } from '../../services/auction.service';
import { PlayersService, Player } from '../../services/players.service';
import { TeamsService, Team } from '../../services/teams.service';
import { AuctionStateService } from '../../services/auction-state.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-auction-control',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    SidePanelComponent,
    AvatarComponent
  ],
  templateUrl: './auction-control.component.html',
  styleUrls: ['./auction-control.component.css'],
  host: { class: 'block h-full w-full min-h-0' }
})
export class AuctionControlComponent implements OnInit {
  // Reactive signals
  loading = signal(false);
  error = signal<string | null>(null);
  auctionConfig = signal<AuctionConfig | null>(null);
  currentPlayer = signal<any>(null);
  teams = signal<Team[]>([]);
  playerSearch = signal('');
  filteredPlayers = signal<any[]>([]);


  // Form
  sellForm: FormGroup;

  // Side Panel state
  showSellPanel = signal<boolean>(false);
  selectedTeamForSale = signal<Team | null>(null);

  // Computed values
  auctionStatus = computed(() => this.auctionStateService.auctionConfig()?.status ?? 'draft');

  // Micro-animation flag
  playerJustSold = signal<boolean>(false);

  totalPlayers = computed(() => {
    // Count all active players that can be auctioned
    return this.auctionStateService.players().filter(p => p.is_active).length;
  });

  soldPlayers = computed(() => {
    // Count players that have been sold
    return this.auctionStateService.players().filter(p => p.auction_status === 'SOLD').length;
  });

  remainingPlayers = computed(() => {
    // Count players that are available for auction (PENDING status)
    return this.auctionStateService.players().filter(p => p.auction_status === 'PENDING').length;
  });

  /** True when INIT / START / COMPLETE controls should render (hide empty wrapper when completed). */
  hasControlActions = computed(() => {
    const status = this.auctionStatus();
    if (status === 'draft' || status === 'active') return true;
    return status !== 'completed'
      && this.remainingPlayers() === 0
      && this.totalPlayers() > 0;
  });

  progressPercentage = computed(() => {
    if (this.totalPlayers() === 0) return 0;
    return Math.round((this.soldPlayers() / this.totalPlayers()) * 100);
  });

  availableTeams = computed(() => {
    return this.teams().filter(team => 
      team.budget_remaining >= (this.currentPlayer()?.base_price || 0) &&
      team.players_count < team.max_players
    );
  });

  constructor(
    private auctionService: AuctionService,
    private playersService: PlayersService,
    private teamsService: TeamsService,
    private auctionStateService: AuctionStateService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private supabase: SupabaseService
  ) {
    this.sellForm = this.fb.group({
      team_id: ['', [Validators.required]],
      price: [0, [Validators.required, Validators.min(0)]],
      notes: ['']
    });

    // Player search form removed - using simple input binding

    // Effect to update price validation when current player changes
    effect(() => {
      const currentPlayer = this.currentPlayer();
      if (currentPlayer) {
        const priceControl = this.sellForm.get('price');
        if (priceControl) {
          priceControl.setValidators([
            Validators.required, 
            Validators.min(currentPlayer.base_price)
          ]);
          priceControl.updateValueAndValidity();
          priceControl.setValue(currentPlayer.base_price);
        }
      }
    });
  }

  async ngOnInit() {
    await this.auctionStateService.loadAllData(this.auctionId());
    this.auctionStateService.setupRealtimeSubscriptions(this.auctionId());

    // Update local signals
    this.auctionConfig.set(this.auctionStateService.auctionConfig());
    this.currentPlayer.set(this.auctionStateService.currentPlayer());
    this.teams.set(this.auctionStateService.teams());
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

  async loadAuctionConfig() {
    this.loading.set(true);
    const { data, error } = await this.auctionService.getAuctionConfig();
    
    if (error) {
      this.error.set(error.message);
      this.showToast('error', `Error loading auction config: ${error.message}`);
    } else if (data) {
      this.auctionConfig.set(data);
      await this.loadCurrentPlayer();
    }
    this.loading.set(false);
  }

  async loadTeams() {
    this.loading.set(true);
    const { data, error } = await this.teamsService.getTeams(this.auctionId());
    
    if (error) {
      this.error.set(error.message);
      this.showToast('error', `Error loading teams: ${error.message}`);
    } else if (data) {
      this.teams.set(data);
    }
    this.loading.set(false);
  }

  async loadCurrentPlayer() {
    try {
      // Get current player from auction state service
      const currentPlayer = this.auctionStateService.currentPlayer();
      this.currentPlayer.set(currentPlayer);
    } catch (error: any) {
      console.error('Error loading current player:', error);
      this.currentPlayer.set(null);
    }
  }



  async updateAuctionStatus(status: 'active' | 'completed') {
    if (!this.auctionId()) return;
    this.loading.set(true);
    try {
      const { error } = await this.supabase.db
        .from('auctions')
        .update({ status })
        .eq('id', this.auctionId());
      if (!error) {
        // Refresh full state
        await this.auctionStateService.loadAllData(this.auctionId());
        this.showToast('success', `Auction marked as ${status}`);
      } else {
        throw error;
      }
    } catch (e: any) {
      this.error.set(e.message);
      this.showToast('error', `Error updating status: ${e.message}`);
    } finally {
      this.loading.set(false);
    }
  }

  // startAuction method removed - auction status management not needed

  async resetAuction() {
    if (!confirm('Are you sure you want to reset the auction? This will clear all progress, including sold players, team budgets, and auction history.')) {
      return;
    }

    this.loading.set(true);
    try {
      await this.auctionStateService.resetAuction();
      this.showToast('success', 'Auction reset successfully! All data has been cleared.');

      // Refresh all data using centralized service
      await this.auctionStateService.loadAllData(this.auctionId());

      // Update local signals
      this.auctionConfig.set(this.auctionStateService.auctionConfig());
      this.currentPlayer.set(this.auctionStateService.currentPlayer());
      this.teams.set(this.auctionStateService.teams());
      
    } catch (error: any) {
      this.error.set(error.message);
      this.showToast('error', `Error resetting auction: ${error.message}`);
    } finally {
      this.loading.set(false);
    }
  }

  async initializeAuction() {
    this.loading.set(true);
    try {
      // Get all active players
      const { data: players, error } = await this.playersService.getPlayers();
      
      if (error) {
        throw error;
      }

      if (!players || players.length === 0) {
        this.showToast('error', 'No players found. Please add players first.');
        return;
      }

      // Get active player IDs
      const activePlayerIds = players
        .filter(p => p.is_active)
        .map(p => p.id);

      if (activePlayerIds.length === 0) {
        this.showToast('error', 'No active players found. Please activate some players first.');
        return;
      }

      // Add all active players to auction (set to PENDING status)
      await this.auctionStateService.addPlayersToAuction(activePlayerIds);
      
      this.showToast('success', `Successfully added ${activePlayerIds.length} players to the auction!`);
      
      // Refresh data
      await this.auctionStateService.loadAllData(this.auctionId());

      // Update local signals
      this.auctionConfig.set(this.auctionStateService.auctionConfig());
      this.currentPlayer.set(this.auctionStateService.currentPlayer());
      this.teams.set(this.auctionStateService.teams());
      
    } catch (error: any) {
      this.error.set(error.message);
      this.showToast('error', `Error initializing auction: ${error.message}`);
    } finally {
      this.loading.set(false);
    }
  }

  // Trigger micro-animation for sold player
  private triggerSoldAnimation() {
    this.playerJustSold.set(true);
    setTimeout(() => this.playerJustSold.set(false), 1500);
  }


  async markUnsold() {
    if (!this.currentPlayer()) return;

    this.loading.set(true);
    try {
      // Mark current player as UNSOLD
      await this.auctionStateService.updatePlayerAuctionStatus(
        this.currentPlayer()!.id,
        'UNSOLD'
      );
      
      this.showToast('success', 'Player marked as unsold!');
      
      // Update local signals
      this.currentPlayer.set(this.auctionStateService.currentPlayer());
      this.teams.set(this.auctionStateService.teams());
    } catch (error: any) {
      this.error.set(error.message);
      this.showToast('error', `Error marking player unsold: ${error.message}`);
    } finally {
      this.loading.set(false);
    }
  }

  openSellDialog(team?: Team) {
    this.selectedTeamForSale.set(team || null);
    this.sellForm.patchValue({
      team_id: team ? team.id : '',
      price: this.currentPlayer()?.base_price || 0,
      notes: ''
    });
    this.showSellPanel.set(true);
  }

  closeSellDialog() {
    this.showSellPanel.set(false);
    this.selectedTeamForSale.set(null);
    this.sellForm.reset();
  }

  async sellPlayer() {
    if (!this.sellForm.valid || !this.currentPlayer()) return;

    this.loading.set(true);
    const formData = this.sellForm.value;
    
    try {
      // Update player auction status to SOLD
      await this.auctionStateService.updatePlayerAuctionStatus(
        this.currentPlayer()!.id,
        'SOLD'
      );
      
      // Add to auction history — include auction_id for workspace scoping
      await this.auctionStateService.addBidToHistory({
        player_id: this.currentPlayer()!.id,
        winning_team_id: formData.team_id,
        final_price: formData.price,
        auction_date: new Date().toISOString().split('T')[0],
        status: 'SOLD',
        notes: formData.notes || undefined,
        auction_id: this.auctionId(),
      });

      // Assign player to team — include auction_id
      await this.auctionStateService.assignPlayerToTeam({
        team_id: formData.team_id,
        player_id: this.currentPlayer()!.id,
        purchase_price: formData.price,
        purchased_at: new Date().toISOString(),
        auction_id: this.auctionId(),
      });
      
      this.triggerSoldAnimation();
      this.showToast('success', 'Player sold successfully!');
      this.sellForm.reset();
      
      // Update local signals
      this.currentPlayer.set(this.auctionStateService.currentPlayer());
      this.teams.set(this.auctionStateService.teams());
      
      this.closeSellDialog();
    } catch (error: any) {
      this.error.set(error.message);
      this.showToast('error', `Error selling player: ${error.message}`);
    } finally {
      this.loading.set(false);
    }
  }

  formatNumber(num: number | undefined | null): string {
    if (num === undefined || num === null) return '0';
    return new Intl.NumberFormat('en-IN').format(num);
  }

  // Basic custom toast mechanism
  toast = signal<{ type: 'success' | 'error', message: string } | null>(null);
  
  private showToast(type: 'success' | 'error', message: string) {
    this.toast.set({ type, message });
    setTimeout(() => this.toast.set(null), 3000);
  }

  clearError(): void {
    this.error.set(null);
  }

  // Player search methods
  onPlayerSearch(event: any) {
    const searchTerm = event.target.value.toLowerCase();
    this.playerSearch.set(searchTerm);
    this.filterPlayers();
  }

  filterPlayers() {
    const searchTerm = this.playerSearch();
    if (!searchTerm) {
      this.filteredPlayers.set([]);
      return;
    }

    const allPlayers = this.auctionStateService.players();
    const filtered = allPlayers.filter(player => 
      player.is_active && 
      player.auction_status !== 'SOLD' &&
      player.name.toLowerCase().includes(searchTerm)
    );
    this.filteredPlayers.set(filtered);
  }

  async selectPlayer(player: any) {
    this.loading.set(true);
    try {
      // Set the selected player as current
      await this.auctionStateService.updatePlayerAuctionStatus(player.id, 'CURRENT');
      
      this.showToast('success', `Started auction for ${player.name}!`);
      
      // Update local signals
      this.currentPlayer.set(this.auctionStateService.currentPlayer());
      this.playerSearch.set('');
      this.filteredPlayers.set([]);
      
    } catch (error: any) {
      this.error.set(error.message);
      this.showToast('error', `Error starting player auction: ${error.message}`);
    } finally {
      this.loading.set(false);
    }
  }
} 