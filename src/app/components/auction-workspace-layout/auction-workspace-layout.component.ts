import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Router,
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  ActivatedRoute,
  NavigationEnd,
} from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { SupabaseService, UserRole } from '../../services/supabase.service';
import { VersionService } from '../../services/version.service';
import { Auction } from '../../services/auctions.service';
import { MatIconModule } from '@angular/material/icon';
import { UserProfileComponent } from '../shared/user-profile/user-profile.component';

interface WorkspaceNavItem {
  label: string;
  icon: string;
  segment: string; // the child segment, e.g. 'overview'
}

@Component({
  selector: 'app-auction-workspace-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, UserProfileComponent],

  templateUrl: './auction-workspace-layout.component.html',
  styleUrls: ['./auction-workspace-layout.component.css'],
})
export class AuctionWorkspaceLayoutComponent implements OnInit, OnDestroy {
  // ── State ────────────────────────────────────────────────────────────────────
  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  loading = signal(false);

  auction = signal<Auction | null>(null);
  auctionId = signal<string>('');

  user = signal<any>(null);
  userRole = signal<UserRole>('user');
  currentRoute = signal<string>('');

  // ── Computed ──────────────────────────────────────────────────────────────────
  appVersion = computed(() => this.versionService.getVersionWithPrefix());
  appVersionShort = computed(() => this.versionService.getShortVersionWithPrefix());

  auctionName = computed(() => this.auction()?.name ?? 'Loading…');

  auctionStatus = computed(() => this.auction()?.status ?? null);

  /** Label shown in the sidebar header status badge */
  statusLabel = computed(() => {
    const s = this.auctionStatus();
    switch (s) {
      case 'active':    return 'Live';
      case 'paused':    return 'Paused';
      case 'completed': return 'Completed';
      default:          return 'Draft';
    }
  });

  userDisplayName = computed(() => {
    const u = this.user();
    return u?.email ? u.email.split('@')[0] : 'User';
  });

  isAdmin = computed(() => this.userRole() === 'super_admin');

  /** Full route prefix for building child links */
  baseRoute = computed(() => `/auction/${this.auctionId()}`);

  currentSegmentLabel = computed(() => {
    const route = this.currentRoute();
    const item = this.navItems.find(n => route.includes(`/auction/${this.auctionId()}/${n.segment}`));
    return item ? item.label : 'Overview';
  });

  // ── Workspace Nav ────────────────────────────────────────────────────────────
  readonly navItems: WorkspaceNavItem[] = [
    { label: 'Dashboard',        icon: 'bar_chart',        segment: 'overview' },
    { label: 'Manage Teams',     icon: 'emoji_events',     segment: 'teams' },
    { label: 'Player Pool',      icon: 'sports_cricket',   segment: 'players' },
    { label: 'Auction Desk',     icon: 'gavel',            segment: 'control' },
    { label: 'Current Squads',   icon: 'groups',           segment: 'rosters' },
    { label: 'Bid History',      icon: 'history',          segment: 'history' },
    { label: 'Auction Settings', icon: 'settings',         segment: 'settings' },
  ];

  private subs = new Subscription();

  constructor(
    private supabaseService: SupabaseService,
    private versionService: VersionService,
    private route: ActivatedRoute,
    private router: Router
  ) {}


  ngOnInit(): void {
    // Track user & role
    this.subs.add(
      this.supabaseService.currentUser.subscribe(u => this.user.set(u))
    );
    this.subs.add(
      this.supabaseService.userRole.subscribe(r => this.userRole.set(r))
    );

    // Close mobile sidebar on navigation & track current route
    this.subs.add(
      this.router.events
        .pipe(filter(e => e instanceof NavigationEnd))
        .subscribe((event: any) => {
          this.currentRoute.set(event.urlAfterRedirects || event.url);
          this.mobileMenuOpen.set(false);
        })
    );

    // Initial route
    this.currentRoute.set(this.router.url);

    // Load auction from route param
    this.loadAuction();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async loadAuction(): Promise<void> {
    // Walk up the route tree to get the :id param from /auction/:id
    let r = this.route;
    while (r) {
      const id = r.snapshot.paramMap.get('id');
      if (id) {
        this.auctionId.set(id);
        await this.fetchAuction(id);
        return;
      }
      r = r.parent!;
    }
    // If we still don't have an id, redirect home
    this.router.navigate(['/home']);
  }

  private async fetchAuction(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabaseService.db
        .from('auctions')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        console.error('Auction not found or access denied, redirecting home');
        this.router.navigate(['/home']);
        return;
      }

      this.auction.set(data as Auction);
    } finally {
      this.loading.set(false);
    }
  }

  /** Build full route for a nav segment, e.g. '/auction/abc/teams' */
  navRoute(segment: string): string {
    return `${this.baseRoute()}/${segment}`;
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(c => !c);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(o => !o);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  onOverlayClick(): void {
    this.closeMobileMenu();
  }

  onSidebarClick(event: Event): void {
    event.stopPropagation();
  }

  async onSignOut(): Promise<void> {
    try {
      await this.supabaseService.signOut();
      this.router.navigate(['/login']);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }

  /** Copy public share link to clipboard */
  async copyShareLink(): Promise<void> {
    const slug = this.auction()?.public_slug;
    if (!slug) return;
    const url = `${window.location.origin}/view/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // fallback: do nothing
    }
  }
}
