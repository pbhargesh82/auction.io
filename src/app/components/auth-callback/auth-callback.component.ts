import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `<div></div>`,
  styles: []
})
export class AuthCallbackComponent implements OnInit {
  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      const { user, error } = await this.supabaseService.waitForOAuthSession();

      if (error) {
        console.error('Auth callback error:', error);
        this.router.navigate(['/login'], { queryParams: { error: 'oauth_callback_failed' } });
        return;
      }

      if (user) {
        this.router.navigate(['/home']);
      } else {
        this.router.navigate(['/login'], { queryParams: { error: 'oauth_callback_failed' } });
      }
    } catch (err) {
      console.error('Unexpected error in auth callback:', err);
      this.router.navigate(['/login'], { queryParams: { error: 'oauth_callback_failed' } });
    }
  }
}
