import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent {
  // Signals for reactive state management
  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  user = signal<any>(null);

  // Navigation menu items
  menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z M3 7l9 6 9-6',
      route: '/dashboard'
    },
    {
      label: 'Team Roster',
      icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
      route: '/team-roster'
    },
    {
      label: 'Teams',
      icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75 M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      route: '/teams'
    },
    {
      label: 'Players',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0z M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      route: '/players'
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
    private router: Router
  ) {
    // Get current user
    this.supabaseService.currentUser.subscribe(user => {
      this.user.set(user);
    });
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