import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { SupabaseService } from '../../services/supabase.service';
import { Player } from '../../services/players.service';

// ── Types ─────────────────────────────────────────────────────────────────────

type AuctionStatus = 'PENDING' | 'CURRENT' | 'SOLD' | 'UNSOLD' | 'SKIPPED';

export interface AuctionPlayer {
  id: string;           // auction_players PK
  auction_id: string;
  player_id: string;
  base_price: number;
  auction_status: AuctionStatus;
  // joined from players
  player: Player;
  // joined from team_players / auction_history
  sold_team_name?: string;
  sold_price?: number;
}

type StatusFilter = 'all' | AuctionStatus;

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-auction-players',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './auction-players.component.html',
  styleUrls: ['./auction-players.component.css'],
})
export class AuctionPlayersComponent implements OnInit {
  // ── Core state ────────────────────────────────────────────────────────────
  auctionId     = signal('');
  auctionPlayers= signal<AuctionPlayer[]>([]);
  loading       = signal(true);
  saving        = signal(false);

  // ── Pool modal ────────────────────────────────────────────────────────────
  showModal     = signal(false);
  poolPlayers   = signal<Player[]>([]);
  poolLoading   = signal(false);
  poolSearch    = signal('');
  selectedIds   = signal<Set<string>>(new Set());

  // ── Edit base-price modal ─────────────────────────────────────────────────
  showEditModal     = signal(false);
  editingAP         = signal<AuctionPlayer | null>(null);
  editForm: FormGroup;

  // ── Filters ───────────────────────────────────────────────────────────────
  searchTerm    = signal('');
  statusFilter  = signal<StatusFilter>('all');

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast         = signal<{ msg: string; type: 'ok' | 'err' } | null>(null);
  private toastTimer: any;

  // ── Computed ──────────────────────────────────────────────────────────────
  filtered = computed(() => {
    const q = this.searchTerm().toLowerCase();
    const s = this.statusFilter();
    return this.auctionPlayers().filter(ap => {
      const matchQ = !q || ap.player.name.toLowerCase().includes(q)
        || ap.player.category.toLowerCase().includes(q)
        || (ap.player.nationality ?? '').toLowerCase().includes(q);
      const matchS = s === 'all' || ap.auction_status === s;
      return matchQ && matchS;
    });
  });

  stats = computed(() => {
    const all = this.auctionPlayers();
    return {
      total:   all.length,
      sold:    all.filter(a => a.auction_status === 'SOLD').length,
      unsold:  all.filter(a => a.auction_status === 'UNSOLD').length,
      pending: all.filter(a => a.auction_status === 'PENDING').length,
      skipped: all.filter(a => a.auction_status === 'SKIPPED').length,
    };
  });

  // Pool players not already in auction
  poolFiltered = computed(() => {
    const q = this.poolSearch().toLowerCase();
    const existingIds = new Set(this.auctionPlayers().map(ap => ap.player_id));
    return this.poolPlayers().filter(p =>
      !existingIds.has(p.id) &&
      (!q || p.name.toLowerCase().includes(q)
          || p.category.toLowerCase().includes(q)
          || (p.nationality ?? '').toLowerCase().includes(q))
    );
  });

  poolSelectedCount = computed(() => this.selectedIds().size);
  isAllPoolSelected = computed(() =>
    this.poolFiltered().length > 0 &&
    this.poolFiltered().every(p => this.selectedIds().has(p.id))
  );

  statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all',     label: 'All' },
    { value: 'PENDING', label: 'Available' },
    { value: 'SOLD',    label: 'Sold' },
    { value: 'UNSOLD',  label: 'Unsold' },
    { value: 'SKIPPED', label: 'Skipped' },
  ];

  constructor(
    private route: ActivatedRoute,
    private supabase: SupabaseService,
    private fb: FormBuilder,
  ) {
    this.editForm = this.fb.group({
      base_price: [100_000, [Validators.required, Validators.min(1000)]],
    });
  }

  ngOnInit(): void {
    let r: ActivatedRoute | null = this.route;
    while (r) {
      const id = r.snapshot.paramMap.get('id');
      if (id) { this.auctionId.set(id); break; }
      r = r.parent;
    }
    if (this.auctionId()) this.loadAuctionPlayers();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  async loadAuctionPlayers() {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.db
        .from('auction_players')
        .select(`
          id, auction_id, player_id, base_price, auction_status,
          player:players(*)
        `)
        .eq('auction_id', this.auctionId())
        .order('created_at', { ascending: true });

      if (error) { this.showToast(error.message, 'err'); return; }

      // Build enriched list — retrieve sold info from auction_history
      const raw = (data ?? []) as any[];
      const soldPlayerIds = raw
        .filter(r => r.auction_status === 'SOLD')
        .map(r => r.player_id);

      let historyMap: Record<string, { team: string; price: number }> = {};
      if (soldPlayerIds.length > 0) {
        const { data: hist } = await this.supabase.db
          .from('auction_history')
          .select(`player_id, final_price, team:teams!auction_history_winning_team_id_fkey(name)`)
          .eq('auction_id', this.auctionId())
          .in('player_id', soldPlayerIds);

        (hist ?? []).forEach((h: any) => {
          const teamName = Array.isArray(h.team) ? h.team[0]?.name : h.team?.name;
          historyMap[h.player_id] = { team: teamName ?? '–', price: h.final_price ?? 0 };
        });
      }

      const entries: AuctionPlayer[] = raw.map(r => ({
        id:             r.id,
        auction_id:     r.auction_id,
        player_id:      r.player_id,
        base_price:     r.base_price,
        auction_status: r.auction_status as AuctionStatus,
        player:         Array.isArray(r.player) ? r.player[0] : r.player,
        sold_team_name: historyMap[r.player_id]?.team,
        sold_price:     historyMap[r.player_id]?.price,
      }));

      this.auctionPlayers.set(entries);
    } finally {
      this.loading.set(false);
    }
  }

  // ── Pool modal ────────────────────────────────────────────────────────────

  async openModal() {
    this.poolSearch.set('');
    this.selectedIds.set(new Set());
    this.showModal.set(true);
    this.poolLoading.set(true);
    try {
      const user = this.supabase.currentUserValue;
      const { data, error } = await this.supabase.db
        .from('players')
        .select('*')
        .eq('owner_id', user!.id)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (!error) this.poolPlayers.set((data ?? []) as Player[]);
    } finally {
      this.poolLoading.set(false);
    }
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedIds.set(new Set());
  }

  togglePool(id: string) {
    const s = new Set(this.selectedIds());
    s.has(id) ? s.delete(id) : s.add(id);
    this.selectedIds.set(s);
  }

  toggleAllPool() {
    if (this.isAllPoolSelected()) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(this.poolFiltered().map(p => p.id)));
    }
  }

  async addSelected() {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;
    this.saving.set(true);
    try {
      const rows = ids.map(playerId => {
        const player = this.poolPlayers().find(p => p.id === playerId)!;
        return {
          auction_id:     this.auctionId(),
          player_id:      playerId,
          base_price:     player.base_price,
          auction_status: 'PENDING',
        };
      });

      const { error } = await this.supabase.db
        .from('auction_players')
        .insert(rows);

      if (error) { this.showToast(error.message, 'err'); }
      else {
        this.showToast(`${ids.length} player${ids.length > 1 ? 's' : ''} added!`);
        this.closeModal();
        await this.loadAuctionPlayers();
      }
    } finally {
      this.saving.set(false);
    }
  }

  async addAllFromPool() {
    await this.openModal();
    // Select all filtered
    this.selectedIds.set(new Set(this.poolFiltered().map(p => p.id)));
    await this.addSelected();
  }

  // ── Edit base price ───────────────────────────────────────────────────────

  openEdit(ap: AuctionPlayer) {
    this.editingAP.set(ap);
    this.editForm.patchValue({ base_price: ap.base_price });
    this.showEditModal.set(true);
  }

  closeEdit() {
    this.showEditModal.set(false);
    this.editingAP.set(null);
  }

  async saveBasePrice() {
    if (this.editForm.invalid || !this.editingAP()) return;
    this.saving.set(true);
    try {
      const { error } = await this.supabase.db
        .from('auction_players')
        .update({ base_price: this.editForm.value.base_price })
        .eq('id', this.editingAP()!.id);

      if (error) { this.showToast(error.message, 'err'); }
      else {
        this.showToast('Base price updated.');
        this.closeEdit();
        await this.loadAuctionPlayers();
      }
    } finally {
      this.saving.set(false);
    }
  }

  // ── Remove ────────────────────────────────────────────────────────────────

  async removeFromAuction(ap: AuctionPlayer) {
    if (ap.auction_status === 'SOLD') {
      if (!confirm(`"${ap.player.name}" is already SOLD. Remove anyway?`)) return;
    }
    this.saving.set(true);
    try {
      const { error } = await this.supabase.db
        .from('auction_players')
        .delete()
        .eq('id', ap.id);
      if (error) { this.showToast(error.message, 'err'); }
      else {
        this.showToast('Player removed from auction.');
        this.auctionPlayers.update(list => list.filter(a => a.id !== ap.id));
      }
    } finally {
      this.saving.set(false);
    }
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  async removeUnsold() {
    const unsold = this.auctionPlayers().filter(ap => ap.auction_status === 'UNSOLD');
    if (!unsold.length) { this.showToast('No unsold players to remove.'); return; }
    if (!confirm(`Remove ${unsold.length} unsold player(s) from auction?`)) return;
    this.saving.set(true);
    try {
      const ids = unsold.map(ap => ap.id);
      const { error } = await this.supabase.db
        .from('auction_players').delete().in('id', ids);
      if (error) { this.showToast(error.message, 'err'); }
      else {
        this.showToast(`${ids.length} unsold player(s) removed.`);
        await this.loadAuctionPlayers();
      }
    } finally { this.saving.set(false); }
  }

  async resetStatuses() {
    if (!confirm('Reset all non-sold player statuses back to PENDING?')) return;
    this.saving.set(true);
    try {
      const resetIds = this.auctionPlayers()
        .filter(ap => ap.auction_status !== 'SOLD')
        .map(ap => ap.id);
      if (!resetIds.length) { this.showToast('Nothing to reset.'); return; }
      const { error } = await this.supabase.db
        .from('auction_players')
        .update({ auction_status: 'PENDING' })
        .in('id', resetIds);
      if (error) { this.showToast(error.message, 'err'); }
      else {
        this.showToast('Statuses reset to PENDING.');
        await this.loadAuctionPlayers();
      }
    } finally { this.saving.set(false); }
  }

  // ── Utils ─────────────────────────────────────────────────────────────────

  onOverlayClick(e: MouseEvent, closeAll = false) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      closeAll ? this.closeModal() : this.closeEdit();
    }
  }

  setStatus(v: StatusFilter) { this.statusFilter.set(v); }

  formatCurrency(v: number): string {
    if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
    if (v >= 100_000)    return `₹${(v / 100_000).toFixed(1)}L`;
    return `₹${v.toLocaleString('en-IN')}`;
  }

  statusMeta(s: AuctionStatus): { label: string; cls: string } {
    switch (s) {
      case 'SOLD':    return { label: 'Sold',      cls: 'badge--sold' };
      case 'UNSOLD':  return { label: 'Unsold',    cls: 'badge--unsold' };
      case 'CURRENT': return { label: 'On Block',  cls: 'badge--current' };
      case 'SKIPPED': return { label: 'Skipped',   cls: 'badge--skipped' };
      default:        return { label: 'Available', cls: 'badge--pending' };
    }
  }

  trackAP(_: number, ap: AuctionPlayer) { return ap.id; }
  trackPlayer(_: number, p: Player)     { return p.id; }

  private showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    clearTimeout(this.toastTimer);
    this.toast.set({ msg, type });
    this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
  }
}
