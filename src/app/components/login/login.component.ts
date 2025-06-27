import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private fb = new FormBuilder();

  // Signals for reactive state management
  loading = signal(false);
  hidePassword = signal(true);
  loginError = signal<string | null>(null);
  formTouched = signal(false);

  // Reactive form with validation
  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  // Computed signals for form validation
  isFormValid = computed(() => {
    const form = this.loginForm;
    return form.valid && !this.loading();
  });
  
  emailControl = computed(() => this.loginForm.get('email'));
  passwordControl = computed(() => this.loginForm.get('password'));

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {
    // Listen to form changes to trigger validation updates
    this.loginForm.valueChanges.subscribe(() => {
      this.formTouched.set(true);
    });
  }

  togglePasswordVisibility(): void {
    this.hidePassword.update(hidden => !hidden);
  }

  async onSubmit(): Promise<void> {
    // Mark form as touched to show validation errors
    this.loginForm.markAllAsTouched();
    
    if (!this.loginForm.valid) {
      console.log('Form is invalid:', this.loginForm.errors);
      return;
    }

    this.loading.set(true);
    this.loginError.set(null);

    try {
      const { email, password } = this.loginForm.value;
      
      if (!email || !password) {
        this.loginError.set('Please fill in all required fields.');
        return;
      }

      console.log('Attempting login with:', { email, password: '***' });
      
      const { error } = await this.supabaseService.signIn(email, password);

      if (error) {
        console.error('Supabase login error:', error);
        this.loginError.set(this.getErrorMessage(error.message));
      } else {
        console.log('Login successful!');
        this.router.navigate(['/dashboard']);
      }
    } catch (error: any) {
      console.error('Unexpected login error:', error);
      this.loginError.set('An unexpected error occurred. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async onForgotPassword(): Promise<void> {
    const email = this.loginForm.get('email')?.value;
    
    if (!email) {
      alert('Please enter your email address first');
      return;
    }

    try {
      const { error } = await this.supabaseService.resetPassword(email);
      
      if (error) {
        alert(`Password reset failed: ${error.message}`);
      } else {
        alert('Password reset email sent! Check your inbox.');
      }
    } catch (error) {
      alert('Failed to send reset email. Please try again.');
    }
  }

  private getErrorMessage(error: string): string {
    if (error.includes('Invalid login credentials')) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    if (error.includes('Email not confirmed')) {
      return 'Please confirm your email address before signing in.';
    }
    if (error.includes('Too many requests')) {
      return 'Too many login attempts. Please wait a few minutes and try again.';
    }
    return 'Login failed. Please check your credentials and try again.';
  }
} 