import { Component, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { AuctionStateService } from '../../services/auction-state.service';
import { SupabaseService } from '../../services/supabase.service';
import { Auction } from '../../services/auctions.service';

@Component({
  selector: 'app-public-auction',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule
  ],
  templateUrl: './public-auction.component.html',
  styleUrls: ['./public-auction.component.css'],
  host: { class: 'block h-full w-full' }
})
export class PublicAuctionComponent implements OnInit, OnDestroy {
  loading = signal(true);
  error = signal<string | null>(null);
  auction = signal<Auction | null>(null);
  currentUrl = signal<string>('');
  showLargeQr = signal(false);
  
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
      case 'active': return 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20';
      case 'paused': return 'bg-amber-400/10 text-amber-400 border border-amber-400/20';
      case 'completed': return 'bg-blue-400/10 text-blue-400 border border-blue-400/20';
      default: return 'bg-[#EEEEEE]/5 text-[#EEEEEE]/60 border border-[#EEEEEE]/10';
    }
  }
}
