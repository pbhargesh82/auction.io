import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';

import { AuctionStateService } from '../../services/auction-state.service';
import { TeamWithPlayers } from '../../services/auction-state.service';
import { SupabaseService } from '../../services/supabase.service';
import { Auction } from '../../services/auctions.service';
import { TeamCardComponent, TeamCardConfig } from '../team-card/team-card.component';

interface HistoryEntry {
  id: string;
  player_id: string;
  winning_team_id: string;
  sold_price: number;
  sold_at: string;
  player?: { name: string; position?: string; image_url?: string } | null;
  team?:   { name: string; primary_color?: string } | null;
}

@Component({
  selector: 'app-auction-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, TeamCardComponent, MatIconModule],
  templateUrl: './auction-overview.component.html',
  styleUrls: ['./auction-overview.component.css'],
})
export class AuctionOverviewComponent implements OnInit, OnDestroy {
  // ── IDs & auction meta ────────────────────────────────────────────────────
  auctionId      = signal('');
  auction        = signal<Auction | null>(null);
  auctionLoading = signal(false);

  // ── Recent history (last 5) ───────────────────────────────────────────────
  recentHistory  = signal<HistoryEntry[]>([]);
  historyLoading = signal(false);
  linkCopied     = signal(false);

  // ── Derived from AuctionStateService (pre-loaded by guard) ───────────────
  // These are Signal<T> getters — we read them in computed() / templates
  private readonly state: AuctionStateService;

  private subs = new Subscription();
  isTransitioning = signal(false);

  // ── Computed stats ────────────────────────────────────────────────────────
  teamsWithPlayers = computed(() => this.state.teamsWithPlayers());
  loading          = computed(() => this.state.loading());
  error            = computed(() => this.state.error());

  teamCount = computed(() => this.teamsWithPlayers().length);

  totalPlayers = computed(() =>
    this.state.players().filter((p: any) => p.is_active).length
  );

  soldCount = computed(() => this.state.soldPlayers().length);

  progressPct = computed(() => {
    const total = this.totalPlayers();
    return total > 0 ? Math.round((this.soldCount() / total) * 100) : 0;
  });

  totalBudgetCap = computed(() =>
    this.teamsWithPlayers().reduce((s: number, t: any) => s + t.budget_cap, 0)
  );

  totalBudgetSpent = computed(() =>
    this.teamsWithPlayers().reduce((s: number, t: any) => s + t.budget_spent, 0)
  );

  budgetPct = computed(() => {
    const cap = this.totalBudgetCap();
    return cap > 0 ? Math.round((this.totalBudgetSpent() / cap) * 100) : 0;
  });

  auctionStatus = computed(() => this.auction()?.status ?? null);

  statusLabel = computed(() => {
    switch (this.auctionStatus()) {
      case 'active':    return 'Live';
      case 'paused':    return 'Paused';
      case 'completed': return 'Completed';
      default:          return 'Draft';
    }
  });

  canStart = computed(() =>
    this.teamCount() > 0 &&
    this.totalPlayers() > 0 &&
    this.auctionStatus() !== 'completed'
  );

  teamCardConfig: TeamCardConfig = {
    showPlayers: false,
    showActions: false,
    showBudgetDetails: true,
    showPlayerStats: true,
    compact: true,
    variant: 'dashboard',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    stateService: AuctionStateService,
    private supabase: SupabaseService,
  ) {
    this.state = stateService;
  }

  ngOnInit(): void {
    // Resolve :id — walk up the route tree
    let r: ActivatedRoute | null = this.route;
    while (r) {
      const id = r.snapshot.paramMap.get('id');
      if (id) { this.auctionId.set(id); break; }
      r = r.parent;
    }

    if (this.auctionId()) {
      this.fetchAuction();
      this.fetchRecentHistory();
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Data fetching ─────────────────────────────────────────────────────────

  private async fetchAuction() {
    this.auctionLoading.set(true);
    try {
      const { data, error } = await this.supabase.db
        .from('auctions')
        .select('*')
        .eq('id', this.auctionId())
        .single();
      if (!error && data) this.auction.set(data as Auction);
    } finally {
      this.auctionLoading.set(false);
    }
  }

  private async fetchRecentHistory() {
    this.historyLoading.set(true);
    try {
      const { data, error } = await this.supabase.db
        .from('auction_history')
        .select(`
          id, player_id, winning_team_id, final_price, sold_at,
          player:players(name, position, image_url),
          team:teams!auction_history_winning_team_id_fkey(name, primary_color)
        `)
        .eq('auction_id', this.auctionId())
        .order('sold_at', { ascending: false })
        .limit(5);

      if (!error && data) {
        // Supabase returns relation as array or object depending on cardinality
        const entries: HistoryEntry[] = (data as any[]).map(row => ({
          ...row,
          sold_price: row.final_price ?? 0,
          player: Array.isArray(row.player) ? row.player[0] ?? null : row.player,
          team:   Array.isArray(row.team)   ? row.team[0]   ?? null : row.team,
        }));
        this.recentHistory.set(entries);
      }
    } finally {
      this.historyLoading.set(false);
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  goToControl()  { this.router.navigate(['/auction', this.auctionId(), 'control']); }
  goToPlayers()  { this.router.navigate(['/auction', this.auctionId(), 'players']); }
  goToTeams()    { this.router.navigate(['/auction', this.auctionId(), 'teams']); }
  goToHistory()  { this.router.navigate(['/auction', this.auctionId(), 'history']); }
  goToSettings() { this.router.navigate(['/auction', this.auctionId(), 'settings']); }

  async updateAuctionStatus(status: 'active' | 'completed') {
    if (!this.auctionId()) return;
    this.isTransitioning.set(true);
    try {
      const { error } = await this.supabase.db
        .from('auctions')
        .update({ status })
        .eq('id', this.auctionId());
      if (!error) {
        // optimistically update local state
        this.auction.update(a => a ? { ...a, status } : a);
        // if started, navigate to control automatically
        if (status === 'active') {
          this.goToControl();
        }
      }
    } finally {
      this.isTransitioning.set(false);
    }
  }

  async copyShareLink() {
    const slug = this.auction()?.public_slug;
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/view/${slug}`);
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    } catch { /* ignore */ }
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  formatCurrency(v: number): string {
    if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
    if (v >= 100_000)    return `₹${(v / 100_000).toFixed(1)}L`;
    return `₹${v.toLocaleString('en-IN')}`;
  }

  formatTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  trackTeam(_: number, t: TeamWithPlayers) { return t.id; }
  trackHistory(_: number, h: HistoryEntry)  { return h.id; }
}
