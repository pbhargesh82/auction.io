import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: { class: 'block h-full w-full' }
})
export class App implements OnInit {
  protected title = 'auction.io';
  private router = inject(Router);

  ngOnInit(): void {
    const hash = window.location.hash;
    const onCallbackRoute = window.location.pathname === '/auth/callback';

    if (!onCallbackRoute && (hash.includes('access_token=') || hash.includes('error='))) {
      this.router.navigateByUrl(`/auth/callback${hash}`);
    }
  }
}
