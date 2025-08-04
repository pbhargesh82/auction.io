import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `<div></div>`, // Empty template since we don't need any UI
  styles: []
})
export class AuthCallbackComponent implements OnInit {
  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      console.log('Handling auth callback...');
      
      // Wait for auth initialization
      await this.supabaseService.waitForAuthInitialization();
      
      // Handle the OAuth callback
      const { data, error } = await this.supabaseService.handleAuthCallback();
      
      if (error) {
        console.error('Auth callback error:', error);
        this.router.navigate(['/login']);
        return;
      }

      // Check if user is authenticated
      const user = this.supabaseService.currentUserValue;
      if (user) {
        console.log('User authenticated successfully:', user.email);
        // Redirect immediately to dashboard
        this.router.navigate(['/dashboard']);
      } else {
        console.log('No user found after auth callback');
        this.router.navigate(['/login']);
      }
    } catch (err: any) {
      console.error('Unexpected error in auth callback:', err);
      this.router.navigate(['/login']);
    }
  }
} 