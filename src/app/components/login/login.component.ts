import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
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
  styleUrls: ['./login.component.css'],
  host: { class: 'block h-full w-full' }
})
export class LoginComponent implements OnInit {
  private fb = new FormBuilder();

  loading = signal(false);
  hidePassword = signal(true);
  loginError = signal<string | null>(null);
  signupSuccess = signal<string | null>(null);
  isSignUp = signal(false);
  formRevision = signal(0);

  currentYear = new Date().getFullYear();

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['']
  });

  isFormValid = computed(() => {
    this.formRevision();
    this.isSignUp();
    return this.loginForm.valid && !this.loading();
  });

  emailControl = computed(() => this.loginForm.get('email'));
  passwordControl = computed(() => this.loginForm.get('password'));
  confirmPasswordControl = computed(() => this.loginForm.get('confirmPassword'));

  passwordMatchError = computed(() => {
    this.formRevision();
    if (!this.isSignUp()) return null;
    const confirmPassword = this.loginForm.get('confirmPassword');
    if (confirmPassword?.hasError('required') && confirmPassword.touched) {
      return null;
    }
    return this.loginForm.hasError('passwordMismatch')
      ? 'Passwords do not match'
      : null;
  });

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm.valueChanges.subscribe(() => {
      this.formRevision.update(n => n + 1);
    });

    this.loginForm.statusChanges.subscribe(() => {
      this.formRevision.update(n => n + 1);
    });
  }

  async ngOnInit() {
    await this.supabaseService.waitForAuthInitialization();
    const user = this.supabaseService.currentUserValue;

    if (user) {
      const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/home';
      this.router.navigate([returnUrl]);
      return;
    }

    this.setMode(false);

    const oauthError = this.route.snapshot.queryParams['error'];
    if (oauthError === 'oauth_callback_failed') {
      this.loginError.set(
        'Sign-in completed but your session could not be established. Please try again.'
      );
    }
  }

  togglePasswordVisibility(): void {
    this.hidePassword.update(hidden => !hidden);
  }

  setMode(isSignUp: boolean): void {
    if (this.isSignUp() === isSignUp) return;
    this.isSignUp.set(isSignUp);
    this.loginError.set(null);
    this.signupSuccess.set(null);
    this.loginForm.reset();

    if (isSignUp) {
      this.loginForm.get('confirmPassword')?.setValidators([Validators.required]);
      this.loginForm.setValidators(this.passwordMatchValidator);
    } else {
      this.loginForm.get('confirmPassword')?.clearValidators();
      this.loginForm.clearValidators();
    }

    this.loginForm.get('confirmPassword')?.updateValueAndValidity();
    this.loginForm.updateValueAndValidity();
    this.formRevision.update(n => n + 1);
  }

  mouseX = signal(50);
  mouseY = signal(50);

  onMouseMove(event: MouseEvent): void {
    const x = (event.clientX / window.innerWidth) * 100;
    const y = (event.clientY / window.innerHeight) * 100;
    this.mouseX.set(x);
    this.mouseY.set(y);
  }

  async onSubmit(): Promise<void> {
    this.loginForm.markAllAsTouched();

    if (!this.isFormValid()) {
      return;
    }

    this.loading.set(true);
    this.loginError.set(null);
    this.signupSuccess.set(null);

    try {
      const { email, password } = this.loginForm.value;

      if (!email || !password) {
        this.loginError.set('Please fill in all required fields.');
        return;
      }

      if (this.isSignUp()) {
        const result = await this.supabaseService.signUp(email, password);

        if (result.error) {
          this.loginError.set(this.getErrorMessage(result.error.message));
        } else if (result.data.session) {
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/home';
          this.router.navigate([returnUrl]);
        } else {
          this.signupSuccess.set(
            'Account created. Check your email to confirm your address, then sign in.'
          );
          this.setMode(false);
        }
      } else {
        const result = await this.supabaseService.signIn(email, password);

        if (result.error) {
          this.loginError.set(this.getErrorMessage(result.error.message));
        } else {
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/home';
          this.router.navigate([returnUrl]);
        }
      }
    } catch {
      this.loginError.set('An unexpected error occurred. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.loading.set(true);
    this.loginError.set(null);
    this.signupSuccess.set(null);

    try {
      const { error } = await this.supabaseService.signInWithGoogle();

      if (error) {
        this.loginError.set(this.getErrorMessage(error.message));
        this.loading.set(false);
      }
    } catch {
      this.loginError.set('An unexpected error occurred during Google sign-in. Please try again.');
      this.loading.set(false);
    }
  }

  private passwordMatchValidator = (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;

    if (!confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  };

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
