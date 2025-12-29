import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { SupabaseService, UserRole } from '../../services/supabase.service';
import { VersionService } from '../../services/version.service';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs/operators';

interface MenuItem {
  label: string;
  icon: string; // Material icon name
  route: string;
  badge?: number;
  requiresAdmin?: boolean;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent {
  // Signals for reactive state management
  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  user = signal<any>(null);
  userRole = signal<UserRole>('user');
  currentRoute = signal<string>('');

  // App version - computed from service
  appVersion = computed(() => this.versionService.getVersionWithPrefix());
  appVersionShort = computed(() => this.versionService.getShortVersionWithPrefix());

  // Computed signal for current page title
  currentPageTitle = computed(() => {
    const route = this.currentRoute();
    const menuItem = this.menuItems.find(item => item.route === route);
    return menuItem ? menuItem.label : 'Dashboard';
  });

  // Computed signal for admin status
  isAdmin = computed(() => this.userRole() === 'admin');

  // Computed signal for filtered menu items based on role
  filteredMenuItems = computed(() => {
    return this.menuItems.filter(item => !item.requiresAdmin || this.isAdmin());
  });

  // Navigation menu items
  menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'dashboard',
      route: '/dashboard'
    },
    {
      label: 'Auction Control',
      icon: 'gavel',
      route: '/auction-control',
      requiresAdmin: true
    },
    {
      label: 'Auction Config',
      icon: 'settings',
      route: '/auction-config',
      requiresAdmin: true
    },
    {
      label: 'Auction History',
      icon: 'history',
      route: '/auction-history'
    },
    {
      label: 'Team Roster',
      icon: 'groups',
      route: '/team-roster'
    },
    {
      label: 'Teams',
      icon: 'flag',
      route: '/teams',
      requiresAdmin: true
    },
    {
      label: 'Players',
      icon: 'sports_cricket',
      route: '/players',
      requiresAdmin: true
    },
    {
      label: 'User Management',
      icon: 'manage_accounts',
      route: '/user-management',
      requiresAdmin: true
    }
  ];

  // Computed signals
  userDisplayName = computed(() => {
    const currentUser = this.user();
    if (currentUser?.email) {
      return currentUser.email.split('@')[0];
    }
    return 'User';
  });

  constructor(
    private supabaseService: SupabaseService,
    private versionService: VersionService,
    private router: Router
  ) {
    // Get current user and role
    this.supabaseService.currentUser.subscribe(user => {
      this.user.set(user);
    });

    this.supabaseService.userRole.subscribe(role => {
      this.userRole.set(role);
    });

    // Track route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute.set(event.url);
    });

    // Set initial route
    this.currentRoute.set(this.router.url);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(collapsed => !collapsed);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(open => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  async onSignOut(): Promise<void> {
    try {
      await this.supabaseService.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  // Close mobile menu when clicking outside
  onOverlayClick(): void {
    this.closeMobileMenu();
  }

  // Prevent menu close when clicking inside sidebar
  onSidebarClick(event: Event): void {
    event.stopPropagation();
  }
} 