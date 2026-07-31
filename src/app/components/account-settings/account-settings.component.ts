import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import { Router } from '@angular/router';

import { ProfileService } from '../../services/profile.service';
import { SupabaseService } from '../../services/supabase.service';
import { ImageUploadService } from '../../services/image-upload.service';
import { ToastService } from '../../services/toast.service';
import { UserProfile } from '../../models/user-profile.interface';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (!newPassword || !confirmPassword) {
    return null;
  }
  return newPassword === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './account-settings.component.html',
  styleUrls: ['./account-settings.component.css'],
  host: { class: 'block h-full w-full min-h-0' }
})
export class AccountSettingsComponent implements OnInit {
  loading = signal(true);
  savingProfile = signal(false);
  savingPassword = signal(false);
  uploadingAvatar = signal(false);

  profileForm: FormGroup;
  passwordForm: FormGroup;

  isEmailUser = computed(() => this.profileService.isEmailUser());
  isGoogleUser = computed(() => this.profileService.isGoogleUser());
  avatarUrl = computed(() => this.profileService.avatarUrl());
  displayName = computed(() => this.profileService.displayName());

  userEmail = signal('');
  emailConfirmed = signal(true);
  authProviderLabel = computed(() =>
    this.isGoogleUser() ? 'Google' : 'Email & password'
  );

  initials = computed(() => {
    const name = this.displayName();
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

  constructor(
    private fb: FormBuilder,
    private profileService: ProfileService,
    private supabase: SupabaseService,
    private imageUpload: ImageUploadService,
    private toast: ToastService,
    private router: Router
  ) {
    this.profileForm = this.fb.group({
      display_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      full_name: ['', [Validators.maxLength(100)]],
      bio: ['', [Validators.maxLength(500)]],
      phone_number: ['', [Validators.pattern(/^$|^\+?[0-9\s\-().]{7,20}$/)]]
    });

    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', [Validators.required, Validators.minLength(6)]],
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]]
      },
      { validators: passwordMatchValidator }
    );
  }

  ngOnInit(): void {
    void this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    this.loading.set(true);
    try {
      const user = this.supabase.currentUserValue;
      if (user) {
        this.userEmail.set(user.email ?? '');
        this.emailConfirmed.set(!!user.email_confirmed_at);
      }

      const { data, error } = await this.profileService.getCurrentProfile();
      if (error) {
        this.toast.error(error);
        return;
      }

      if (data) {
        this.patchProfileForm(data);
      }
    } finally {
      this.loading.set(false);
    }
  }

  private patchProfileForm(profile: UserProfile): void {
    this.profileForm.patchValue({
      display_name: profile.display_name ?? '',
      full_name: profile.full_name ?? '',
      bio: profile.bio ?? '',
      phone_number: profile.phone_number ?? ''
    });
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.savingProfile.set(true);

    const value = this.profileForm.value;
    const result = await this.profileService.updateProfile({
      display_name: value.display_name,
      full_name: value.full_name,
      bio: value.bio,
      phone_number: value.phone_number
    });

    this.savingProfile.set(false);

    if (result.success) {
      this.toast.success('Profile updated successfully');
    } else {
      this.toast.error(result.error ?? 'Failed to update profile');
    }
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.uploadingAvatar.set(true);
    const result = await this.profileService.uploadAvatar(file);
    this.uploadingAvatar.set(false);
    input.value = '';

    if (result.success) {
      this.toast.success('Avatar updated');
    } else {
      this.toast.error(result.error ?? 'Avatar upload failed');
    }
  }

  async removeAvatar(): Promise<void> {
    this.uploadingAvatar.set(true);
    const result = await this.profileService.removeAvatar();
    this.uploadingAvatar.set(false);

    if (result.success) {
      this.toast.success('Avatar removed');
    } else {
      this.toast.error(result.error ?? 'Failed to remove avatar');
    }
  }

  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.savingPassword.set(true);

    const { currentPassword, newPassword } = this.passwordForm.value;
    const result = await this.profileService.updatePassword(currentPassword, newPassword);

    this.savingPassword.set(false);

    if (result.success) {
      this.passwordForm.reset();
      this.toast.success('Password updated successfully');
    } else {
      this.toast.error(result.error ?? 'Failed to update password');
    }
  }

  async onSignOut(): Promise<void> {
    try {
      await this.supabase.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  avatarUploadStatus = computed(() => {
    if (this.uploadingAvatar()) {
      return this.imageUpload.statusText();
    }
    return '';
  });
}
