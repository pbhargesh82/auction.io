import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { Auction, AuctionsService } from '../../services/auctions.service';

@Component({
  selector: 'app-auction-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './auction-settings.component.html',
  styleUrls: ['./auction-settings.component.css'],
  host: { class: 'block h-full w-full min-h-0' }
})
export class AuctionSettingsComponent implements OnInit {
  // ── State ─────────────────────────────────────────────────────────────────
  auctionId    = signal('');
  auction      = signal<Auction | null>(null);
  loading      = signal(true);
  saving       = signal(false);
  resetting    = signal(false);
  deleting     = signal(false);
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
    private auctionsService: AuctionsService,
    private toast: ToastService,
    private fb: FormBuilder
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

      if (error) {
        this.toast.error(error.message);
      } else if (data) {
        this.auction.set(data as Auction);
        this.toast.success('Auction settings saved');
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
      `Reset "${this.auction()?.name}"?\n\nThis will:\n• Set status back to Draft\n• Reset all player statuses in this auction\n• Clear all team budgets and assignments\n• Delete all auction history\n\nTeams and the player pool stay. This cannot be undone.`
    )) return;

    this.resetting.set(true);
    try {
      const { error } = await this.auctionsService.resetAuction(this.auctionId());
      if (error) {
        this.toast.error(`Failed to reset auction: ${error.message}`);
        return;
      }

      await this.loadAuction();
      this.toast.success('Auction reset successfully.');
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
      if (typed !== null) this.toast.error('Name did not match — deletion cancelled.');
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
        this.toast.error('Failed to delete auction: ' + error.message);
      }
    } finally {
      this.deleting.set(false);
    }
  }
}
