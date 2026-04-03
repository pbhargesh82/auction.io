import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

/**
 * DashboardComponent — Phase 3.2: Deprecated.
 * Immediately redirects to /home (My Auctions).
 * The /dashboard route already redirects in app.routes.ts,
 * but this stub catches any remaining direct component navigations.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [],
  template: '',
})
export class DashboardComponent implements OnInit {
  constructor(private router: Router) {}

  ngOnInit(): void {
    this.router.navigate(['/home'], { replaceUrl: true });
  }
}