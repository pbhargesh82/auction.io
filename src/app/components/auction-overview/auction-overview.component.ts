import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';

/**
 * AuctionOverviewComponent — Per-auction dashboard.
 * Replaces the old global DashboardComponent.
 * This is a stub created in Phase 1.1 (routing scaffold).
 * Full implementation will be done in Phase 3.1.
 */
@Component({
  selector: 'app-auction-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="overview-stub">
      <h1>Auction Overview</h1>
      <p>Auction ID: <strong>{{ auctionId }}</strong></p>
      <p>Phase 3 implementation coming soon…</p>
    </div>
  `,
  styles: [`
    .overview-stub {
      padding: 2rem;
      text-align: center;
      color: var(--text-primary, #fff);
    }
  `]
})
export class AuctionOverviewComponent implements OnInit {
  auctionId = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Read auctionId from parent route params (set by the auction workspace route)
    this.auctionId = this.route.snapshot.paramMap.get('id') ?? '';
  }
}
