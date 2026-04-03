import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * PlayerPoolComponent — Global player catalog (renamed from "My Players").
 * This is a stub created in Phase 1.1 (routing scaffold).
 * Full implementation will be done in Phase 5.1 when PlayersComponent is refactored here.
 */
@Component({
  selector: 'app-player-pool',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="player-pool-stub">
      <h1>Player Pool</h1>
      <p>Phase 5 implementation coming soon…</p>
    </div>
  `,
  styles: [`
    .player-pool-stub {
      padding: 2rem;
      text-align: center;
      color: var(--text-primary, #fff);
    }
  `]
})
export class PlayerPoolComponent {}
