import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuctionsService } from '../../services/auctions.service';
import { Auction } from '../../services/auctions.service';
import { SidePanelComponent } from '../shared/side-panel/side-panel.component';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, SidePanelComponent],
  templateUrl: './home.component.html',
  host: { class: 'block h-full w-full min-h-0' }
})
export class HomeComponent implements OnInit {
  // ── State ────────────────────────────────────────────────────────────────────
  searchQuery   = signal('');
  statusFilter  = signal<'all' | Auction['status']>('all');
  showModal     = signal(false);
  editingAuction = signal<Auction | null>(null);
  duplicating   = signal(false);
  submitting    = signal(false);
  deletingId    = signal<string | null>(null);
  copiedId      = signal<string | null>(null);

  // ── Form ─────────────────────────────────────────────────────────────────────
  auctionForm: FormGroup;

  // ── Computed ──────────────────────────────────────────────────────────────────
  loading  = computed(() => this.auctionsSvc.loading());
  allAuctions = computed(() => this.auctionsSvc.auctions());

  filteredAuctions = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const s = this.statusFilter();
    return this.allAuctions().filter(a => {
      const matchesSearch = !q || a.name.toLowerCase().includes(q)
        || (a.description ?? '').toLowerCase().includes(q);
      const matchesStatus = s === 'all' || a.status === s;
      return matchesSearch && matchesStatus;
    });
  });

  isEditing = computed(() => this.editingAuction() !== null && !this.duplicating());
  modalTitle = computed(() => {
    if (this.duplicating()) return 'Duplicate Auction';
    return this.isEditing() ? 'Edit Auction' : 'Create New Auction';
  });

  statusOptions: { value: 'all' | Auction['status']; label: string }[] = [
    { value: 'all',       label: 'All Auctions' },
    { value: 'draft',     label: 'Draft' },
    { value: 'active',    label: 'Live' },
    { value: 'paused',    label: 'Paused' },
    { value: 'completed', label: 'Completed' },
  ];

  constructor(
    private auctionsSvc: AuctionsService,
    private fb: FormBuilder,
    private router: Router,
    private toast: ToastService,
  ) {
    this.auctionForm = this.fb.group({
      name:                 ['', [Validators.required, Validators.minLength(3)]],
      description:          [''],
      budget_per_team:      [10_000_000, [Validators.required, Validators.min(1000)]],
      max_players_per_team: [25, [Validators.required, Validators.min(1)]],
      min_players_per_team: [15, [Validators.required, Validators.min(1)]],
      is_public:            [true],
    });
  }

  async ngOnInit() {
    await this.auctionsSvc.loadAuctions();
  }

  // ── Navigation ────────────────────────────────────────────────────────────────
  enterAuction(auction: Auction) {
    this.router.navigate(['/auction', auction.id, 'overview']);
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────────
  openCreate() {
    this.editingAuction.set(null);
    this.duplicating.set(false);
    this.auctionForm.reset({
      name: '', description: '',
      budget_per_team: 10_000_000,
      max_players_per_team: 25,
      min_players_per_team: 15,
      is_public: true,
    });
    this.showModal.set(true);
  }

  openEdit(auction: Auction) {
    this.editingAuction.set(auction);
    this.duplicating.set(false);
    this.auctionForm.patchValue({
      name:                 auction.name,
      description:          auction.description ?? '',
      budget_per_team:      auction.budget_per_team,
      max_players_per_team: auction.max_players_per_team,
      min_players_per_team: auction.min_players_per_team,
      is_public:            auction.is_public,
    });
    this.showModal.set(true);
  }

  openDuplicate(auction: Auction) {
    this.editingAuction.set(auction);
    this.duplicating.set(true);
    this.auctionForm.patchValue({
      name:                 `${auction.name} (Copy)`,
      description:          auction.description ?? '',
      budget_per_team:      auction.budget_per_team,
      max_players_per_team: auction.max_players_per_team,
      min_players_per_team: auction.min_players_per_team,
      is_public:            auction.is_public,
    });
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingAuction.set(null);
    this.duplicating.set(false);
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async submitForm() {
    if (this.auctionForm.invalid) {
      this.auctionForm.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const v = this.auctionForm.value;

    try {
      if (this.isEditing()) {
        const { error } = await this.auctionsSvc.updateAuction(this.editingAuction()!.id, v);
        if (error) { this.toast.error('Failed to update: ' + error.message); return; }
        this.toast.success('Auction updated successfully!');
      } else {
        // Create or Duplicate (both just create with given values)
        const { error } = await this.auctionsSvc.createAuction(v);
        if (error) { this.toast.error('Failed to create: ' + error.message); return; }
        this.toast.success(this.duplicating() ? 'Auction duplicated!' : 'Auction created!');
      }
      this.closeModal();
    } finally {
      this.submitting.set(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  async deleteAuction(auction: Auction, event: Event) {
    event.stopPropagation();
    if (!confirm(`Delete "${auction.name}"? This cannot be undone.`)) return;
    this.deletingId.set(auction.id);
    try {
      const { error } = await this.auctionsSvc.deleteAuction(auction.id);
      if (error) { this.toast.error('Failed to delete: ' + error.message); }
      else { this.toast.success('Auction deleted.'); }
    } finally {
      this.deletingId.set(null);
    }
  }

  // ── Share ─────────────────────────────────────────────────────────────────────
  async copyShareLink(auction: Auction, event: Event) {
    event.stopPropagation();
    const url = `${window.location.origin}/view/${auction.public_slug}`;
    try {
      await navigator.clipboard.writeText(url);
      this.copiedId.set(auction.id);
      this.toast.success('Share link copied!');
      setTimeout(() => this.copiedId.set(null), 2000);
    } catch {
      this.toast.error('Could not copy link.');
    }
  }

  // ── Utils ─────────────────────────────────────────────────────────────────────
  statusMeta(status: Auction['status']): { label: string; cls: string } {
    switch (status) {
      case 'active':    return { label: 'Live',      cls: 'badge--active' };
      case 'paused':    return { label: 'Paused',    cls: 'badge--paused' };
      case 'completed': return { label: 'Completed', cls: 'badge--completed' };
      default:          return { label: 'Draft',     cls: 'badge--draft' };
    }
  }

  formatCurrency(v: number): string {
    if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
    if (v >= 100_000)    return `₹${(v / 100_000).toFixed(1)}L`;
    return `₹${v.toLocaleString('en-IN')}`;
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  setStatusFilter(v: 'all' | Auction['status']) {
    this.statusFilter.set(v);
  }

  trackByAuction(_: number, a: Auction) { return a.id; }
}
