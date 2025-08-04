import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100 text-center">
          
          <!-- Loading State -->
          @if (loading()) {
            <div class="mb-6">
              <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
                <svg class="animate-spin w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h2 class="text-2xl font-bold text-gray-900 mb-2">Completing Sign In</h2>
              <p class="text-gray-600">Please wait while we complete your authentication...</p>
            </div>
          }

          <!-- Error State -->
          @if (error()) {
            <div class="mb-6">
              <div class="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-2xl mb-4">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h2 class="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
              <p class="text-red-600 mb-4">{{ error() }}</p>
              <button 
                (click)="goToLogin()"
                class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200">
                Back to Login
              </button>
            </div>
          }

          <!-- Success State -->
          @if (success()) {
            <div class="mb-6">
              <div class="inline-flex items-center justify-center w-16 h-16 bg-green-600 rounded-2xl mb-4">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h2 class="text-2xl font-bold text-gray-900 mb-2">Welcome!</h2>
              <p class="text-gray-600">Authentication successful. Redirecting to dashboard...</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class AuthCallbackComponent implements OnInit {
  loading = signal(true);
  error = signal<string | null>(null);
  success = signal(false);

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
        this.error.set('Failed to complete authentication. Please try again.');
        this.loading.set(false);
        return;
      }

      // Check if user is authenticated
      const user = this.supabaseService.currentUserValue;
      if (user) {
        console.log('User authenticated successfully:', user.email);
        this.success.set(true);
        this.loading.set(false);
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1500);
      } else {
        console.log('No user found after auth callback');
        this.error.set('Authentication failed. Please try signing in again.');
        this.loading.set(false);
      }
    } catch (err: any) {
      console.error('Unexpected error in auth callback:', err);
      this.error.set('An unexpected error occurred. Please try again.');
      this.loading.set(false);
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
} 