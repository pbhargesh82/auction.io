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
import { MatFormFieldModule } from '@angular/material/form-field';
import { ActivatedRoute } from '@angular/router';

import { AuctionHistory } from '../../services/auction.service';
import { SupabaseService } from '../../services/supabase.service';

type SortOption = 'time' | 'price' | 'name';
type SortDirection = 'asc' | 'desc';

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
    MatSelectModule,
    MatFormFieldModule
  ],
  templateUrl: './auction-history.component.html',
  styleUrls: ['./auction-history.component.css']
})
export class AuctionHistoryComponent implements OnInit {
  // Reactive signals
  loading = signal(false);
  error = signal<string | null>(null);
  auctionHistory = signal<AuctionHistory[]>([]);
  
  // Sorting signals
  sortBy = signal<SortOption>('time');
  sortDirection = signal<SortDirection>('desc');

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

  // Sorted auction history
  sortedAuctionHistory = computed(() => {
    const history = this.auctionHistory();
    const sortBy = this.sortBy();
    const sortDirection = this.sortDirection();
    
    return [...history].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'time':
          comparison = new Date(a.sold_at).getTime() - new Date(b.sold_at).getTime();
          break;
        case 'price':
          const priceA = a.final_price || 0;
          const priceB = b.final_price || 0;
          comparison = priceA - priceB;
          break;
        case 'name':
          const nameA = a.player?.name || '';
          const nameB = b.player?.name || '';
          comparison = nameA.localeCompare(nameB);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  });

  constructor(
    private supabase: SupabaseService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private route: ActivatedRoute,
  ) {}

  async ngOnInit() {
    await this.loadAuctionHistory();
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

  async loadAuctionHistory() {
    this.loading.set(true);
    this.error.set(null);

    const auctionId = this.auctionId();
    if (!auctionId) {
      this.loading.set(false);
      this.auctionHistory.set([]);
      return;
    }

    try {
      const { data, error } = await this.supabase.db
        .from('auction_history')
        .select(`
          id, player_id, winning_team_id, final_price, auction_date, sold_at,
          auction_round, bidding_duration, notes, status,
          player:players(id, name, position, base_price, image_url),
          team:teams!auction_history_winning_team_id_fkey(id, name, primary_color)
        `)
        .eq('auction_id', auctionId)
        .order('sold_at', { ascending: false });

      if (error) {
        this.error.set(error.message);
        this.snackBar.open(`Error loading auction history: ${error.message}`, 'Close', { duration: 5000 });
      } else {
        // Normalize Supabase array-shaped joins
        const entries = ((data ?? []) as any[]).map(row => ({
          ...row,
          player: Array.isArray(row.player) ? row.player[0] ?? null : row.player,
          team:   Array.isArray(row.team)   ? row.team[0]   ?? null : row.team,
        }));
        this.auctionHistory.set(entries as AuctionHistory[]);
      }
    } catch (err: any) {
      this.error.set(err.message);
      this.snackBar.open(`Error loading auction history: ${err.message}`, 'Close', { duration: 5000 });
    } finally {
      this.loading.set(false);
    }
  }

  async clearHistory() {
    const confirmed = confirm('Are you sure you want to clear all auction history? This action cannot be undone.');
    if (!confirmed) return;

    this.loading.set(true);
    try {
      const { error } = await this.supabase.db
        .from('auction_history')
        .delete()
        .eq('auction_id', this.auctionId());

      if (error) {
        this.error.set(error.message);
        this.snackBar.open(`Error clearing history: ${error.message}`, 'Close', { duration: 5000 });
      } else {
        this.auctionHistory.set([]);
        this.snackBar.open('Auction history cleared successfully!', 'Close', { duration: 3000 });
      }
    } catch (err: any) {
      this.error.set(err.message);
      this.snackBar.open(`Error clearing history: ${err.message}`, 'Close', { duration: 5000 });
    } finally {
      this.loading.set(false);
    }
  }

  async refreshData() {
    await this.loadAuctionHistory();
  }

  // Sorting methods
  onSortChange(sortBy: SortOption) {
    if (this.sortBy() === sortBy) {
      // Toggle direction if same sort field
      this.sortDirection.update(direction => direction === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field with default direction
      this.sortBy.set(sortBy);
      this.sortDirection.set('desc');
    }
  }

  getSortIcon(sortField: SortOption): string {
    if (this.sortBy() !== sortField) {
      return 'unfold_more';
    }
    return this.sortDirection() === 'asc' ? 'expand_less' : 'expand_more';
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