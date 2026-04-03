import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * HomeComponent — My Auctions landing page.
 * This is a stub created in Phase 1.1 (routing scaffold).
 * Full implementation will be done in Phase 2.1.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="home-stub">
      <h1>My Auctions</h1>
      <p>Phase 2 implementation coming soon…</p>
    </div>
  `,
  styles: [`
    .home-stub {
      padding: 2rem;
      text-align: center;
      color: var(--text-primary, #fff);
    }
  `]
})
export class HomeComponent {}
