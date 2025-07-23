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

import { AuctionService, AuctionConfig, PlayerQueue, AuctionHistory } from '../../services/auction.service';
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
  auctionHistory = signal<AuctionHistory[]>([]);

  // Form
  sellForm: FormGroup;

  // Template reference
  @ViewChild('sellDialogTemplate', { static: true }) sellDialogTemplate!: TemplateRef<any>;

  // Computed values
  totalPlayers = computed(() => {
    // Get total players from auction config or player queue
    const config = this.auctionConfig();
    if (config && config.total_players > 0) {
      return config.total_players;
    }
    // Fallback to counting players in queue
    return this.auctionHistory().length + this.teams().reduce((total, team) => total + team.players_count, 0);
  });

  soldPlayers = computed(() => {
    // Count players that have been sold (have a winning_team_id)
    return this.auctionHistory().filter(h => h.winning_team_id && h.status === 'SOLD').length;
  });

  remainingPlayers = computed(() => {
    return this.totalPlayers() - this.soldPlayers();
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
    this.auctionHistory.set(this.auctionStateService.auctionHistory());
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
      // Get current auction config to find the active auction
      const { data: config } = await this.auctionService.getAuctionConfig();
      if (!config) {
        this.currentPlayer.set(null);
        return;
      }

      // Get the first active player from the queue
      const { data: queueData } = await this.auctionService.getPlayerQueue();
      if (!queueData || queueData.length === 0) {
        this.currentPlayer.set(null);
        return;
      }

      const activePlayer = queueData.find(p => p.status === 'CURRENT');
      if (activePlayer) {
        this.currentPlayer.set(activePlayer);
      } else {
        this.currentPlayer.set(null);
      }
    } catch (error: any) {
      console.error('Error loading current player:', error);
      this.currentPlayer.set(null);
    }
  }

  async loadAuctionHistory() {
    this.loading.set(true);
    const { data, error } = await this.auctionService.getAuctionHistory();
    
    if (error) {
      this.error.set(error.message);
      this.snackBar.open(`Error loading auction history: ${error.message}`, 'Close', { duration: 5000 });
    } else if (data) {
      this.auctionHistory.set(data);
    }
    this.loading.set(false);
  }

  async startAuction() {
    this.loading.set(true);
    const { data, error } = await this.auctionService.startAuction();
    
    if (error) {
      this.error.set(error.message);
      this.snackBar.open(`Error starting auction: ${error.message}`, 'Close', { duration: 5000 });
    } else {
      this.snackBar.open('Auction started successfully!', 'Close', { duration: 3000 });
      // Update local signals
      this.auctionConfig.set(this.auctionStateService.auctionConfig());
    }
    this.loading.set(false);
  }

  async pauseAuction() {
    this.loading.set(true);
    const { data, error } = await this.auctionService.pauseAuction();
    
    if (error) {
      this.error.set(error.message);
      this.snackBar.open(`Error pausing auction: ${error.message}`, 'Close', { duration: 5000 });
    } else {
      this.snackBar.open('Auction paused successfully!', 'Close', { duration: 3000 });
      // Update local signals
      this.auctionConfig.set(this.auctionStateService.auctionConfig());
    }
    this.loading.set(false);
  }

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
      this.auctionHistory.set(this.auctionStateService.auctionHistory());
      
    } catch (error: any) {
      this.error.set(error.message);
      this.snackBar.open(`Error resetting auction: ${error.message}`, 'Close', { duration: 5000 });
    } finally {
      this.loading.set(false);
    }
  }

  async nextPlayer() {
    this.loading.set(true);
    try {
      // Get current auction config
      const { data: config } = await this.auctionService.getAuctionConfig();
      if (!config) {
        this.snackBar.open('No auction configuration found!', 'Close', { duration: 5000 });
        return;
      }

      // Get next player using the simplified approach
      const nextPlayer = await this.auctionStateService.getNextPlayer();
      
      if (nextPlayer) {
        this.snackBar.open(`Moved to next player: ${nextPlayer.name}!`, 'Close', { duration: 3000 });
        // Update local signals
        this.currentPlayer.set(this.auctionStateService.currentPlayer());
      } else {
        // No more players
        this.snackBar.open('Auction completed! All players have been processed.', 'Close', { duration: 5000 });
        const { error } = await this.auctionService.endAuction();
        if (error) {
          this.snackBar.open(`Error ending auction: ${error.message}`, 'Close', { duration: 5000 });
        }
        // Update local signals
        this.currentPlayer.set(this.auctionStateService.currentPlayer());
        this.auctionConfig.set(this.auctionStateService.auctionConfig());
      }
    } catch (error: any) {
      this.snackBar.open(`Error in next player operation: ${error.message || 'Unknown error'}`, 'Close', { duration: 5000 });
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
      this.auctionHistory.set(this.auctionStateService.auctionHistory());
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
      this.auctionHistory.set(this.auctionStateService.auctionHistory());
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
} 