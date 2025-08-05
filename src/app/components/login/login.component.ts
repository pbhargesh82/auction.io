import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { Router, ActivatedRoute } from '@angular/router';

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
export class LoginComponent implements OnInit {
  private fb = new FormBuilder();

  // Signals for reactive state management
  loading = signal(false);
  hidePassword = signal(true);
  loginError = signal<string | null>(null);
  formTouched = signal(false);
  isSignUp = signal(false);
  formValiditySignal = signal(false);

  // Reactive form with validation - only require confirmPassword in signup mode
  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: [''] // No validators initially
  });

  // Computed signals for form validation
  isFormValid = computed(() => {
    const form = this.loginForm;
    const isSignUpMode = this.isSignUp();
    const isLoading = this.loading();
    const formValid = this.formValiditySignal();
    
    // Check individual field validity directly
    const emailValid = form.get('email')?.valid ?? false;
    const passwordValid = form.get('password')?.valid ?? false;
    
    // Check password match only in signup mode
    let passwordMatchValid = true;
    if (isSignUpMode) {
      const password = form.get('password')?.value;
      const confirmPassword = form.get('confirmPassword')?.value;
      passwordMatchValid = !!(password && confirmPassword && password === confirmPassword);
    }
    
    // Form is valid if all required fields are valid and passwords match (in signup mode)
    return emailValid && passwordValid && passwordMatchValid && !isLoading;
  });
  
  emailControl = computed(() => this.loginForm.get('email'));
  passwordControl = computed(() => this.loginForm.get('password'));
  confirmPasswordControl = computed(() => this.loginForm.get('confirmPassword'));

  // Computed signal for password match validation
  passwordMatchError = computed(() => {
    if (!this.isSignUp()) return null;
    const password = this.loginForm.get('password')?.value;
    const confirmPassword = this.loginForm.get('confirmPassword')?.value;
    return password && confirmPassword && password !== confirmPassword ? 
      'Passwords do not match' : null;
  });

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // Listen to form changes to trigger validation updates
    this.loginForm.valueChanges.subscribe(() => {
      this.formTouched.set(true);
    });

    // Listen to form status changes
    this.loginForm.statusChanges.subscribe(() => {
      // Update the form validity signal
      this.formValiditySignal.set(this.loginForm.valid);
    });
  }

  async ngOnInit() {
    // Check if user is already authenticated
    await this.supabaseService.waitForAuthInitialization();
    const user = this.supabaseService.currentUserValue;
    
    if (user) {
      console.log('User already authenticated, redirecting to dashboard');
      const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
      this.router.navigate([returnUrl]);
    }

    // Ensure form is properly initialized for login mode
    this.loginForm.get('confirmPassword')?.clearValidators();
    this.loginForm.get('confirmPassword')?.updateValueAndValidity();
    
    // Initialize form validity signal
    this.formValiditySignal.set(this.loginForm.valid);
    
    // Force form validation update
    this.loginForm.updateValueAndValidity();
  }





  togglePasswordVisibility(): void {
    this.hidePassword.update(hidden => !hidden);
  }



  toggleSignUpMode(): void {
    this.isSignUp.update(mode => !mode);
    this.loginError.set(null);
    this.loginForm.reset();
    
    // Update password validation based on mode
    if (this.isSignUp()) {
      this.loginForm.get('confirmPassword')?.setValidators([Validators.required]);
    } else {
      this.loginForm.get('confirmPassword')?.clearValidators();
    }
    this.loginForm.get('confirmPassword')?.updateValueAndValidity();
  }

  async onSubmit(): Promise<void> {
    // Mark form as touched to show validation errors
    this.loginForm.markAllAsTouched();
    
    if (!this.isFormValid()) {
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
      
      let result;
      if (this.isSignUp()) {
        result = await this.supabaseService.signUp(email, password);
      } else {
        result = await this.supabaseService.signIn(email, password);
      }

      if (result.error) {
        this.loginError.set(this.getErrorMessage(result.error.message));
      } else {
        // Redirect to returnUrl if it exists, otherwise go to dashboard
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigate([returnUrl]);
      }
    } catch (error: any) {
      this.loginError.set('An unexpected error occurred. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.loading.set(true);
    this.loginError.set(null);

    try {
      const { error } = await this.supabaseService.signInWithGoogle();
      
      if (error) {
        this.loginError.set(this.getErrorMessage(error.message));
      }
      // The user will be redirected to Google OAuth, then back to /auth/callback
    } catch (error: any) {
      this.loginError.set('An unexpected error occurred during Google sign-in. Please try again.');
      this.loading.set(false);
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
    if (error.includes('User already registered')) {
      return 'An account with this email already exists. Please sign in instead.';
    }
    if (error.includes('Password should be at least')) {
      return 'Password must be at least 6 characters long.';
    }
    return 'Authentication failed. Please check your credentials and try again.';
  }
} 