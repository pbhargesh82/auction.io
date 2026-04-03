import { Component, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

import { AuctionContextService, Auction } from '../../services/auction-context.service';
import { AuctionStateService } from '../../services/auction-state.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-public-auction',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatChipsModule,
    MatDividerModule
  ],
  templateUrl: './public-auction.component.html',
  styleUrls: ['./public-auction.component.css']
})
export class PublicAuctionComponent implements OnInit, OnDestroy {
  loading = signal(true);
  error = signal<string | null>(null);
  auction = signal<Auction | null>(null);
  
  private subscription: any;

  constructor(
    private route: ActivatedRoute,
    private auctionContextService: AuctionContextService,
    public auctionStateService: AuctionStateService,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.error.set('Invalid auction link');
      this.loading.set(false);
      return;
    }

    try {
      const { data, error } = await this.auctionContextService.getPublicAuction(slug);
      if (error || !data) {
        this.error.set('Auction not found or it is not public');
        return;
      }

      this.auction.set(data);
      // Initialize state for this specific auction
      await this.auctionStateService.loadAllData(data.id);
      
      // Setup realtime subscription for this specific auction
      this.setupRealtimeControl(data.id);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load auction');
    } finally {
      this.loading.set(false);
    }
  }

  setupRealtimeControl(auctionId: string) {
    // Listen for changes and refresh data
    this.subscription = this.supabaseService.db
      .channel(`public-auction-${auctionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions', filter: `id=eq.${auctionId}` }, () => {
          this.auctionContextService.getPublicAuction(this.auction()?.public_slug || '').then(({data}) => {
              if (data) this.auction.set(data);
          });
          this.auctionStateService.loadAllData(auctionId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `auction_id=eq.${auctionId}` }, () => this.auctionStateService.loadAllData(auctionId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_players', filter: `auction_id=eq.${auctionId}` }, () => this.auctionStateService.loadAllData(auctionId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_players', filter: `auction_id=eq.${auctionId}` }, () => this.auctionStateService.loadAllData(auctionId))
      .subscribe();
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.supabaseService.db.removeChannel(this.subscription);
    }
  }

  formatNumber(num: number | undefined | null): string {
    if (num === undefined || num === null) return '0';
    return new Intl.NumberFormat('en-IN').format(num);
  }

  getStatusClass(status: string | undefined): string {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
}
