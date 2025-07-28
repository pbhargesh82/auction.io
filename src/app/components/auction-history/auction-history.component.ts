import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';

import { AuctionService, AuctionHistory } from '../../services/auction.service';
import { AuctionStateService } from '../../services/auction-state.service';

@Component({
  selector: 'app-auction-history',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSelectModule
  ],
  templateUrl: './auction-history.component.html',
  styleUrls: ['./auction-history.component.css']
})
export class AuctionHistoryComponent implements OnInit {
  // Reactive signals
  loading = signal(false);
  error = signal<string | null>(null);
  auctionHistory = signal<AuctionHistory[]>([]);

  // Computed values
  totalTransactions = computed(() => this.auctionHistory().length);
  
  soldPlayers = computed(() => 
    this.auctionHistory().filter(h => h.winning_team_id && h.status === 'SOLD').length
  );
  
  unsoldPlayers = computed(() => 
    this.auctionHistory().filter(h => !h.winning_team_id || h.status === 'UNSOLD').length
  );
  
  totalRevenue = computed(() => 
    this.auctionHistory()
      .filter(h => h.winning_team_id && h.status === 'SOLD')
      .reduce((sum, h) => sum + (h.final_price || 0), 0)
  );

  averagePrice = computed(() => {
    const sold = this.soldPlayers();
    return sold > 0 ? this.totalRevenue() / sold : 0;
  });

  // Sorting
  sortOption = signal<'time' | 'name' | 'price'>('time');

  sortedAuctionHistory = computed(() => {
    const data = [...this.auctionHistory()];
    switch (this.sortOption()) {
      case 'name':
        return data.sort((a, b) => (a.player?.name || '').localeCompare(b.player?.name || ''));
      case 'price':
        return data.sort((a, b) => (b.final_price || 0) - (a.final_price || 0));
      case 'time':
      default:
        return data.sort((a, b) => new Date(b.auction_date).getTime() - new Date(a.auction_date).getTime());
    }
  });

  constructor(
    private auctionService: AuctionService,
    private auctionStateService: AuctionStateService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  async ngOnInit() {
    await this.loadAuctionHistory();
  }

  async loadAuctionHistory() {
    this.loading.set(true);
    this.error.set(null);
    
    try {
      const { data, error } = await this.auctionService.getAuctionHistory();
      
      if (error) {
        this.error.set(error.message);
        this.snackBar.open(`Error loading auction history: ${error.message}`, 'Close', { duration: 5000 });
      } else {
        this.auctionHistory.set(data || []);
      }
    } catch (error: any) {
      this.error.set(error.message);
      this.snackBar.open(`Error loading auction history: ${error.message}`, 'Close', { duration: 5000 });
    } finally {
      this.loading.set(false);
    }
  }

  async clearHistory() {
    const confirmed = confirm('Are you sure you want to clear all auction history? This action cannot be undone.');
    if (!confirmed) return;

    this.loading.set(true);
    try {
      const { error } = await this.auctionService.clearAuctionHistory();
      
      if (error) {
        this.error.set(error.message);
        this.snackBar.open(`Error clearing history: ${error.message}`, 'Close', { duration: 5000 });
      } else {
        this.auctionHistory.set([]);
        this.snackBar.open('Auction history cleared successfully!', 'Close', { duration: 3000 });
      }
    } catch (error: any) {
      this.error.set(error.message);
      this.snackBar.open(`Error clearing history: ${error.message}`, 'Close', { duration: 5000 });
    } finally {
      this.loading.set(false);
    }
  }

  async refreshData() {
    await this.loadAuctionHistory();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'SOLD': return 'bg-green-100 text-green-800';
      case 'UNSOLD': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  clearError(): void {
    this.error.set(null);
  }
} 