import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';

/**
 * AuctionSettingsComponent — Per-auction configuration (renamed from AuctionConfigComponent).
 * This is a stub created in Phase 1.1 (routing scaffold).
 * Full implementation will be done in Phase 4.5.
 */
@Component({
  selector: 'app-auction-settings',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="auction-settings-stub">
      <h1>Auction Settings</h1>
      <p>Auction ID: <strong>{{ auctionId }}</strong></p>
      <p>Phase 4 implementation coming soon…</p>
    </div>
  `,
  styles: [`
    .auction-settings-stub {
      padding: 2rem;
      text-align: center;
      color: var(--text-primary, #fff);
    }
  `]
})
export class AuctionSettingsComponent implements OnInit {
  auctionId = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.auctionId = this.route.snapshot.paramMap.get('id') ?? '';
  }
}
