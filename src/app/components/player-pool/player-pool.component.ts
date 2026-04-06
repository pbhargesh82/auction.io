import { Component } from '@angular/core';
import { PlayersComponent } from '../players/players.component';

/**
 * PlayerPoolComponent (/player-pool) — Phase 5.1
 *
 * The global player catalog. Pure delegation to PlayersComponent which
 * already implements full CRUD, search/filter, image upload and CSV state.
 * No auction-specific context is passed — this is the owner's master pool.
 */
@Component({
  selector: 'app-player-pool',
  standalone: true,
  imports: [PlayersComponent],
  template: `<app-players />`,
  styles: [`:host { display: contents; }`],
})
export class PlayerPoolComponent {}
