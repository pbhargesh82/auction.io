import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

interface AuctionStats {
  totalAuctions: number;
  activeAuctions: number;
  completedAuctions: number;
  totalBids: number;
}

interface RecentAuction {
  id: string;
  title: string;
  endDate: Date;
  currentBid: number;
  status: 'active' | 'completed' | 'pending';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  // Signals for reactive state management
  loading = signal(true);
  user = signal<any>(null);
  stats = signal<AuctionStats>({
    totalAuctions: 0,
    activeAuctions: 0,
    completedAuctions: 0,
    totalBids: 0
  });
  recentAuctions = signal<RecentAuction[]>([]);
  error = signal<string | null>(null);

  // Computed signals
  welcomeMessage = computed(() => {
    const currentUser = this.user();
    if (currentUser?.email) {
      const name = currentUser.email.split('@')[0];
      return `Welcome back, ${name}!`;
    }
    return 'Welcome to your dashboard!';
  });

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadDashboardData();
  }

  private async loadDashboardData() {
    this.loading.set(true);
    this.error.set(null);

    try {
      // Get current user
      const currentUser = this.supabaseService.currentUserValue;
      if (!currentUser) {
        this.router.navigate(['/login']);
        return;
      }
      
      this.user.set(currentUser);

      // Load mock data for now (replace with real API calls later)
      await this.loadMockData();

    } catch (error: any) {
      this.error.set('Failed to load dashboard data. Please try again.');
      console.error('Dashboard error:', error);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadMockData() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock stats data
    this.stats.set({
      totalAuctions: 24,
      activeAuctions: 8,
      completedAuctions: 16,
      totalBids: 156
    });

    // Mock recent auctions data
    this.recentAuctions.set([
      {
        id: '1',
        title: 'Vintage Camera Collection',
        endDate: new Date(Date.now() + 86400000 * 2), // 2 days from now
        currentBid: 450,
        status: 'active'
      },
      {
        id: '2',
        title: 'Art Supplies Bundle',
        endDate: new Date(Date.now() + 86400000 * 5), // 5 days from now
        currentBid: 125,
        status: 'active'
      },
      {
        id: '3',
        title: 'Electronics Lot',
        endDate: new Date(Date.now() - 86400000), // 1 day ago
        currentBid: 890,
        status: 'completed'
      },
      {
        id: '4',
        title: 'Furniture Set',
        endDate: new Date(Date.now() + 86400000 * 7), // 7 days from now
        currentBid: 0,
        status: 'pending'
      }
    ]);
  }

  onCreateAuction() {
    // Navigate to create auction page (to be implemented)
    alert('Create auction feature coming soon!');
  }

  onViewAuction(auctionId: string) {
    // Navigate to auction details (to be implemented)
    alert(`View auction ${auctionId} - coming soon!`);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'completed':
        return 'text-gray-600 bg-gray-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }
} 