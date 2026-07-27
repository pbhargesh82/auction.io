import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { AuctionHistory } from '../../services/auction.service';
import { SupabaseService } from '../../services/supabase.service';
import { AvatarComponent } from '../shared/avatar/avatar.component';

type SortOption = 'time' | 'price' | 'name';
type SortDirection = 'asc' | 'desc';

type AuctionHistoryUI = AuctionHistory & {
  _fmtFinalPrice?: string;
  _fmtDate?: string;
};

@Component({
  selector: 'app-auction-history',
  standalone: true,
  imports: [CommonModule, AvatarComponent],
  templateUrl: './auction-history.component.html',
  styleUrls: ['./auction-history.component.css'],
  host: { class: 'block h-full w-full min-h-0' }
})
export class AuctionHistoryComponent implements OnInit {
  loading      = signal(false);
  error        = signal<string | null>(null);
  toast        = signal<{ msg: string; type: 'ok' | 'err' } | null>(null);
  auctionHistory = signal<AuctionHistoryUI[]>([]);
  resettingId  = signal<string | null>(null); // tracks which history row is being reset
  
  isMobile     = signal(false);

  sortBy        = signal<SortOption>('time');
  sortDirection = signal<SortDirection>('desc');
  searchTerm    = signal('');

  private toastTimer: any;

  // ── Computed ──────────────────────────────────────────────────────────────
  totalTransactions = computed(() => this.auctionHistory().length);
  soldPlayers  = computed(() => this.auctionHistory().filter(h => h.status === 'SOLD').length);
  unsoldPlayers= computed(() => this.auctionHistory().filter(h => h.status !== 'SOLD').length);

  sortedAuctionHistory = computed(() => {
    const q    = this.searchTerm().toLowerCase();
    const list = q
      ? this.auctionHistory().filter(h =>
          (h.player?.name ?? '').toLowerCase().includes(q) ||
          (h.team?.name   ?? '').toLowerCase().includes(q) ||
          (h.player?.position ?? '').toLowerCase().includes(q)
        )
      : this.auctionHistory();

    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (this.sortBy()) {
        case 'time':  cmp = new Date(a.sold_at).getTime() - new Date(b.sold_at).getTime(); break;
        case 'price': cmp = (a.final_price || 0) - (b.final_price || 0); break;
        case 'name':  cmp = (a.player?.name || '').localeCompare(b.player?.name || ''); break;
      }
      return this.sortDirection() === 'asc' ? cmp : -cmp;
    });
  });

  constructor(private supabase: SupabaseService, private route: ActivatedRoute) {}

  async ngOnInit() {
    if (typeof window !== 'undefined') {
      const mql = window.matchMedia('(max-width: 767px)');
      this.isMobile.set(mql.matches);
      mql.addEventListener('change', e => this.isMobile.set(e.matches));
    }
    await this.loadAuctionHistory();
  }

  private auctionId(): string {
    let r: ActivatedRoute | null = this.route;
    while (r) { const id = r.snapshot.paramMap.get('id'); if (id) return id; r = r.parent; }
    return '';
  }

  async loadAuctionHistory() {
    this.loading.set(true);
    this.error.set(null);
    const auctionId = this.auctionId();
    if (!auctionId) { this.loading.set(false); this.auctionHistory.set([]); return; }

    try {
      const { data, error } = await this.supabase.db
        .from('auction_history')
        .select(`
          id, player_id, winning_team_id, final_price, auction_date, sold_at,
          auction_round, bidding_duration, notes, status,
          player:players(id, name, position, category, base_price, image_url),
          team:teams!auction_history_winning_team_id_fkey(id, name, logo_url, primary_color)
        `)
        .eq('auction_id', auctionId)
        .order('sold_at', { ascending: false });

      if (error) { this.showToast(error.message, 'err'); }
      else {
        const entries = ((data ?? []) as any[]).map(row => ({
          ...row,
          player: Array.isArray(row.player) ? row.player[0] ?? null : row.player,
          team:   Array.isArray(row.team)   ? row.team[0]   ?? null : row.team,
          _fmtFinalPrice: this.formatCompact(row.final_price ?? 0),
          _fmtDate: this.formatDate(row.sold_at)
        }));
        this.auctionHistory.set(entries as AuctionHistoryUI[]);
      }
    } catch (err: any) { this.showToast(err.message, 'err'); }
    finally { this.loading.set(false); }
  }

  /**
   * Reset a SOLD player back to the auction pool.
   * Looks up the team_players row, then calls the sell_player_back_to_pool RPC
   * (same flow as TeamRosterComponent) which removes the row, refunds the team
   * budget and resets the player's sold status in auction_players.
   */
  async resetPlayerToPool(h: AuctionHistory) {
    if (h.status !== 'SOLD' || !h.winning_team_id || !h.player_id) return;
    const playerName = h.player?.name ?? 'this player';
    if (!confirm(`Return ${playerName} to the auction pool? The team budget will be refunded.`)) return;

    this.resettingId.set(h.id);
    try {
      // Find the team_players row using player_id + team_id
      const { data: tpRows, error: fetchErr } = await this.supabase.db
        .from('team_players')
        .select('id, purchase_price')
        .eq('player_id', h.player_id)
        .eq('team_id', h.winning_team_id)
        .limit(1);

      if (fetchErr || !tpRows?.length) {
        this.showToast(fetchErr?.message ?? 'team_players record not found', 'err');
        return;
      }

      const teamPlayerId = tpRows[0].id;

      const { error } = await this.supabase.db.rpc('sell_player_back_to_pool', {
        p_team_player_id: teamPlayerId,
        p_team_id: h.winning_team_id,
        p_player_id: h.player_id,
        p_purchase_price: tpRows[0].purchase_price,
      });

      if (error) { this.showToast(error.message, 'err'); return; }

      this.showToast(`${playerName} returned to pool.`);
      await this.loadAuctionHistory(); // refresh list
    } catch (e: any) { this.showToast(e.message, 'err'); }
    finally { this.resettingId.set(null); }
  }

  isResetting(h: AuctionHistory): boolean { return this.resettingId() === h.id; }

  refreshData() { return this.loadAuctionHistory(); }

  onSortChange(field: SortOption) {
    if (this.sortBy() === field) { this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc'); }
    else { this.sortBy.set(field); this.sortDirection.set('desc'); }
  }

  clearError() { this.error.set(null); }

  formatCompact(amount: number): string {
    if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`;
    if (amount >= 100_000)    return `₹${(amount / 100_000).toFixed(1)}L`;
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  private showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    clearTimeout(this.toastTimer);
    this.toast.set({ msg, type });
    this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
  }
}