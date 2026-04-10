import { Component, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

import { AuctionStateService } from '../../services/auction-state.service';
import { SupabaseService } from '../../services/supabase.service';
import { Auction } from '../../services/auctions.service';

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
  currentUrl = signal<string>('');
  
  private subscription: any;

  constructor(
    private route: ActivatedRoute,
    public auctionStateService: AuctionStateService,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    if (typeof window !== 'undefined') {
      this.currentUrl.set(window.location.href);
    }
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.error.set('Invalid auction link');
      this.loading.set(false);
      return;
    }

    try {
      const { data, error } = await this.supabaseService.db
        .from('auctions')
        .select('*')
        .eq('public_slug', slug)
        .eq('is_public', true)
        .single();
      if (error || !data) {
        this.error.set('Auction not found or it is not public');
        return;
      }

      this.auction.set(data);
      // Initialize state and setup realtime subscriptions for this specific auction
      await this.auctionStateService.loadAllData(data.id);
      this.auctionStateService.setupRealtimeSubscriptions(data.id);
    } catch (err: any) {
      this.error.set(err.message || 'Failed to load auction');
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy() {
    this.auctionStateService.stopRealtimeSubscriptions();
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
