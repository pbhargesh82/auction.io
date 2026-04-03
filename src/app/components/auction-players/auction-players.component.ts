import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';

/**
 * AuctionPlayersComponent — Players added to a specific auction.
 * This is a stub created in Phase 1.1 (routing scaffold).
 * Full implementation will be done in Phase 5.2.
 */
@Component({
  selector: 'app-auction-players',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="auction-players-stub">
      <h1>Auction Players</h1>
      <p>Auction ID: <strong>{{ auctionId }}</strong></p>
      <p>Phase 5 implementation coming soon…</p>
    </div>
  `,
  styles: [`
    .auction-players-stub {
      padding: 2rem;
      text-align: center;
      color: var(--text-primary, #fff);
    }
  `]
})
export class AuctionPlayersComponent implements OnInit {
  auctionId = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.auctionId = this.route.snapshot.paramMap.get('id') ?? '';
  }
}
