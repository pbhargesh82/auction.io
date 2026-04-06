import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { SupabaseService } from '../../services/supabase.service';
import { Auction } from '../../services/auctions.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-auction-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './auction-settings.component.html',
  styleUrls: ['./auction-settings.component.css'],
})
export class AuctionSettingsComponent implements OnInit {
  // ── State ─────────────────────────────────────────────────────────────────
  auctionId    = signal('');
  auction      = signal<Auction | null>(null);
  loading      = signal(true);
  saving       = signal(false);
  resetting    = signal(false);
  deleting     = signal(false);
  saveSuccess  = signal(false);
  slugCopied   = signal(false);

  // ── Form ──────────────────────────────────────────────────────────────────
  settingsForm: FormGroup;

  // ── Computed ──────────────────────────────────────────────────────────────
  isPublic   = computed(() => this.auction()?.is_public ?? false);
  publicSlug = computed(() => this.auction()?.public_slug ?? '');
  shareUrl   = computed(() =>
    this.publicSlug()
      ? `${window.location.origin}/view/${this.publicSlug()}`
      : ''
  );

  statusOptions: { value: Auction['status']; label: string }[] = [
    { value: 'draft',     label: 'Draft'     },
    { value: 'active',    label: 'Live'      },
    { value: 'paused',    label: 'Paused'    },
    { value: 'completed', label: 'Completed' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabase: SupabaseService,
    private fb: FormBuilder,
    public themeService: ThemeService
  ) {
    this.settingsForm = this.fb.group({
      name:                 ['', [Validators.required, Validators.minLength(3)]],
      description:          [''],
      status:               ['draft'],
      budget_per_team:      [10_000_000, [Validators.required, Validators.min(1000)]],
      max_players_per_team: [25, [Validators.required, Validators.min(1)]],
      min_players_per_team: [15, [Validators.required, Validators.min(1)]],
      is_public:            [false],
    });
  }

  ngOnInit(): void {
    // Resolve :id from route param tree
    let r: ActivatedRoute | null = this.route;
    while (r) {
      const id = r.snapshot.paramMap.get('id');
      if (id) { this.auctionId.set(id); break; }
      r = r.parent;
    }
    if (this.auctionId()) this.loadAuction();
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  private async loadAuction() {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.db
        .from('auctions')
        .select('*')
        .eq('id', this.auctionId())
        .single();
      if (!error && data) {
        this.auction.set(data as Auction);
        this.patchForm(data as Auction);
      }
    } finally {
      this.loading.set(false);
    }
  }

  private patchForm(a: Auction) {
    this.settingsForm.patchValue({
      name:                 a.name,
      description:          a.description ?? '',
      status:               a.status,
      budget_per_team:      a.budget_per_team,
      max_players_per_team: a.max_players_per_team,
      min_players_per_team: a.min_players_per_team,
      is_public:            a.is_public,
    });
  }

  // ── Save settings ─────────────────────────────────────────────────────────

  async saveSettings() {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.saveSuccess.set(false);
    try {
      const v = this.settingsForm.value;
      const { data, error } = await this.supabase.db
        .from('auctions')
        .update({
          name:                 v.name,
          description:          v.description || null,
          status:               v.status,
          budget_per_team:      v.budget_per_team,
          max_players_per_team: v.max_players_per_team,
          min_players_per_team: v.min_players_per_team,
          is_public:            v.is_public,
          updated_at:           new Date().toISOString(),
        })
        .eq('id', this.auctionId())
        .select()
        .single();

      if (!error && data) {
        this.auction.set(data as Auction);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      }
    } finally {
      this.saving.set(false);
    }
  }

  // ── Share link ────────────────────────────────────────────────────────────

  async copyShareLink() {
    if (!this.shareUrl()) return;
    try {
      await navigator.clipboard.writeText(this.shareUrl());
      this.slugCopied.set(true);
      setTimeout(() => this.slugCopied.set(false), 2000);
    } catch { /* ignore */ }
  }

  // ── Danger zone ───────────────────────────────────────────────────────────

  async resetAuction() {
    if (!confirm(
      `Reset "${this.auction()?.name}"?\n\nThis will:\n• Clear all team budgets\n• Remove all player assignments\n• Delete all auction history\n\nThis cannot be undone.`
    )) return;

    this.resetting.set(true);
    try {
      // Delete team_players for teams in this auction
      const teamIds = (await this.supabase.db
        .from('teams')
        .select('id')
        .eq('auction_id', this.auctionId())
      ).data?.map((t: any) => t.id) ?? [];

      if (teamIds.length > 0) {
        await this.supabase.db
          .from('team_players')
          .delete()
          .in('team_id', teamIds);

        // Reset team budgets
        await this.supabase.db
          .from('teams')
          .update({ budget_spent: 0, players_count: 0 })
          .in('id', teamIds);
      }

      // Clear auction history for this auction
      await this.supabase.db
        .from('auction_history')
        .delete()
        .eq('auction_id', this.auctionId());

      // Reset player auction statuses
      await this.supabase.db
        .from('players')
        .update({ auction_status: 'PENDING', is_sold: false })
        .eq('auction_id', this.auctionId());

      alert('Auction reset successfully.');
    } finally {
      this.resetting.set(false);
    }
  }

  async deleteAuction() {
    const name = this.auction()?.name ?? '';
    const typed = prompt(
      `Type the auction name to confirm deletion:\n\n"${name}"\n\nThis will permanently delete the auction and ALL its data.`
    );
    if (typed !== name) {
      if (typed !== null) alert('Name did not match — deletion cancelled.');
      return;
    }

    this.deleting.set(true);
    try {
      const { error } = await this.supabase.db
        .from('auctions')
        .delete()
        .eq('id', this.auctionId());

      if (!error) {
        this.router.navigate(['/home']);
      } else {
        alert('Failed to delete auction: ' + error.message);
      }
    } finally {
      this.deleting.set(false);
    }
  }
}
