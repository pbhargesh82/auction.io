import { Component, OnInit, signal, computed, effect, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule } from '@angular/router';

import { AuctionService, AuctionConfig } from '../../services/auction.service';
import { PlayersService, Player } from '../../services/players.service';
import { TeamsService, Team } from '../../services/teams.service';
import { AuctionStateService } from '../../services/auction-state.service';

@Component({
  selector: 'app-auction-control',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatTableModule,
    MatIconModule,
    MatDialogModule,
    MatChipsModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    RouterModule
  ],
  templateUrl: './auction-control.component.html',
  styleUrls: ['./auction-control.component.css']
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

  // Template reference
  @ViewChild('sellDialogTemplate', { static: true }) sellDialogTemplate!: TemplateRef<any>;

  // Computed values
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
    private snackBar: MatSnackBar,
    private dialog: MatDialog
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
    await this.auctionStateService.loadAllData();
    
    // Update local signals
    this.auctionConfig.set(this.auctionStateService.auctionConfig());
    this.currentPlayer.set(this.auctionStateService.currentPlayer());
    this.teams.set(this.auctionStateService.teams());
  }

  async loadAuctionConfig() {
    this.loading.set(true);
    const { data, error } = await this.auctionService.getAuctionConfig();
    
    if (error) {
      this.error.set(error.message);
      this.snackBar.open(`Error loading auction config: ${error.message}`, 'Close', { duration: 5000 });
    } else if (data) {
      this.auctionConfig.set(data);
      await this.loadCurrentPlayer();
    }
    this.loading.set(false);
  }

  async loadTeams() {
    this.loading.set(true);
    const { data, error } = await this.teamsService.getTeams();
    
    if (error) {
      this.error.set(error.message);
      this.snackBar.open(`Error loading teams: ${error.message}`, 'Close', { duration: 5000 });
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



  // startAuction method removed - auction status management not needed

  async resetAuction() {
    if (!confirm('Are you sure you want to reset the auction? This will clear all progress, including sold players, team budgets, and auction history.')) {
      return;
    }

    this.loading.set(true);
    try {
      await this.auctionStateService.resetAuction();
      this.snackBar.open('Auction reset successfully! All data has been cleared.', 'Close', { duration: 3000 });
      
      // Refresh all data using centralized service
      await this.auctionStateService.loadAllData();
      
      // Update local signals
      this.auctionConfig.set(this.auctionStateService.auctionConfig());
      this.currentPlayer.set(this.auctionStateService.currentPlayer());
      this.teams.set(this.auctionStateService.teams());
      
    } catch (error: any) {
      this.error.set(error.message);
      this.snackBar.open(`Error resetting auction: ${error.message}`, 'Close', { duration: 5000 });
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
        this.snackBar.open('No players found. Please add players first.', 'Close', { duration: 5000 });
        return;
      }

      // Get active player IDs
      const activePlayerIds = players
        .filter(p => p.is_active)
        .map(p => p.id);

      if (activePlayerIds.length === 0) {
        this.snackBar.open('No active players found. Please activate some players first.', 'Close', { duration: 5000 });
        return;
      }

      // Add all active players to auction (set to PENDING status)
      await this.auctionStateService.addPlayersToAuction(activePlayerIds);
      
      this.snackBar.open(`Successfully added ${activePlayerIds.length} players to the auction!`, 'Close', { duration: 3000 });
      
      // Refresh data
      await this.auctionStateService.loadAllData();
      
      // Update local signals
      this.auctionConfig.set(this.auctionStateService.auctionConfig());
      this.currentPlayer.set(this.auctionStateService.currentPlayer());
      this.teams.set(this.auctionStateService.teams());
      
    } catch (error: any) {
      this.error.set(error.message);
      this.snackBar.open(`Error initializing auction: ${error.message}`, 'Close', { duration: 5000 });
    } finally {
      this.loading.set(false);
    }
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
      
      this.snackBar.open('Player marked as unsold!', 'Close', { duration: 3000 });
      
      // Update local signals
      this.currentPlayer.set(this.auctionStateService.currentPlayer());
      this.teams.set(this.auctionStateService.teams());
    } catch (error: any) {
      this.error.set(error.message);
      this.snackBar.open(`Error marking player unsold: ${error.message}`, 'Close', { duration: 5000 });
    } finally {
      this.loading.set(false);
    }
  }

  openSellDialog(team?: Team) {
    if (team) {
      this.sellForm.patchValue({
        team_id: team.id,
        price: this.currentPlayer()?.base_price || 0
      });
    }

    const dialogRef = this.dialog.open(this.sellDialogTemplate, {
      width: '500px',
      data: { team }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.sellPlayer();
      }
    });
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
      
      // Add to auction history
      await this.auctionStateService.addBidToHistory({
        player_id: this.currentPlayer()!.id,
        winning_team_id: formData.team_id,
        final_price: formData.price,
        auction_date: new Date().toISOString().split('T')[0],
        status: 'SOLD',
        notes: formData.notes || undefined
      });

      // Assign player to team
      await this.auctionStateService.assignPlayerToTeam({
        team_id: formData.team_id,
        player_id: this.currentPlayer()!.id,
        purchase_price: formData.price,
        purchased_at: new Date().toISOString()
      });
      
      this.snackBar.open('Player sold successfully!', 'Close', { duration: 3000 });
      this.sellForm.reset();
      
      // Update local signals
      this.currentPlayer.set(this.auctionStateService.currentPlayer());
      this.teams.set(this.auctionStateService.teams());
      
      this.dialog.closeAll();
    } catch (error: any) {
      this.error.set(error.message);
      this.snackBar.open(`Error selling player: ${error.message}`, 'Close', { duration: 5000 });
    } finally {
      this.loading.set(false);
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'DRAFT': return 'status-draft';
      case 'ACTIVE': return 'status-active';
      case 'PAUSED': return 'status-paused';
      case 'COMPLETED': return 'status-completed';
      default: return 'status-draft';
    }
  }

  formatNumber(num: number | undefined | null): string {
    if (num === undefined || num === null) return '0';
    return new Intl.NumberFormat('en-IN').format(num);
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
      
      this.snackBar.open(`Started auction for ${player.name}!`, 'Close', { duration: 3000 });
      
      // Update local signals
      this.currentPlayer.set(this.auctionStateService.currentPlayer());
      this.playerSearch.set('');
      this.filteredPlayers.set([]);
      
    } catch (error: any) {
      this.error.set(error.message);
      this.snackBar.open(`Error starting player auction: ${error.message}`, 'Close', { duration: 5000 });
    } finally {
      this.loading.set(false);
    }
  }
} 