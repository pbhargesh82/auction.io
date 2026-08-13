import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { Subscription } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { ImageUploadService } from './image-upload.service';
import {
  AuthProvider,
  UserProfile,
  UserProfileUpdate
} from '../models/user-profile.interface';

@Injectable({
  providedIn: 'root'
})
export class ProfileService implements OnDestroy {
  private _profile = signal<UserProfile | null>(null);
  private _loading = signal(false);
  private _error = signal<string | null>(null);
  private subs = new Subscription();

  profile = this._profile.asReadonly();
  loading = this._loading.asReadonly();
  error = this._error.asReadonly();

  displayName = computed(() => {
    const profile = this._profile();
    if (profile?.display_name) {
      return profile.display_name;
    }
    const user = this.supabase.currentUserValue;
    return user?.email ? user.email.split('@')[0] : 'User';
  });

  avatarUrl = computed(() => this._profile()?.avatar_url ?? null);

  authProvider = computed((): AuthProvider => {
    return this._profile()?.auth_provider ?? this.inferProviderFromUser(this.supabase.currentUserValue);
  });

  isEmailUser = computed(() => this.authProvider() === 'email');
  isGoogleUser = computed(() => this.authProvider() === 'google');

  constructor(
    private supabase: SupabaseService,
    private imageUpload: ImageUploadService
  ) {
    this.subs.add(
      this.supabase.currentUser.subscribe(user => {
        if (user) {
          void this.loadProfile(user);
        } else {
          this._profile.set(null);
          this._error.set(null);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  async getCurrentProfile(): Promise<{ data: UserProfile | null; error: string | null }> {
    const user = this.supabase.currentUserValue;
    if (!user) {
      return { data: null, error: 'Not authenticated' };
    }

    await this.loadProfile(user);
    return { data: this._profile(), error: this._error() };
  }

  async loadProfile(user?: User | null): Promise<void> {
    const currentUser = user ?? this.supabase.currentUserValue;
    if (!currentUser) {
      this._profile.set(null);
      return;
    }

    this._loading.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.db
        .from('user_profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (data) {
        this._profile.set(data as UserProfile);
        return;
      }

      const created = await this.createProfileFromUser(currentUser);
      this._profile.set(created);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load profile';
      this._error.set(message);
      console.error('Profile load error:', err);
    } finally {
      this._loading.set(false);
    }
  }

  async updateProfile(updates: UserProfileUpdate): Promise<{ success: boolean; error?: string }> {
    const user = this.supabase.currentUserValue;
    const profile = this._profile();
    if (!user || !profile) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const payload: UserProfileUpdate = {
        display_name: updates.display_name?.trim() || null,
        full_name: updates.full_name?.trim() || null,
        bio: updates.bio?.trim() || null,
        phone_number: updates.phone_number?.trim() || null
      };

      if (updates.avatar_url !== undefined) {
        payload.avatar_url = updates.avatar_url;
      }

      const { data, error } = await this.supabase.db
        .from('user_profiles')
        .update(payload)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (error) {
        throw new Error(error.message);
      }

      this._profile.set(data as UserProfile);

      await this.syncAuthMetadata(data as UserProfile);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      return { success: false, error: message };
    }
  }

  async uploadAvatar(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
    const user = this.supabase.currentUserValue;
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const compressed = await this.imageUpload.compressImage(file, 400, 0.85);
      const result = await this.imageUpload.uploadImage(compressed, 'avatars', 'avatar.jpg');

      if (!result.success || !result.url) {
        return { success: false, error: result.error ?? 'Upload failed' };
      }

      const oldAvatar = this._profile()?.avatar_url;
      const updateResult = await this.updateProfile({ avatar_url: result.url });
      if (!updateResult.success) {
        return { success: false, error: updateResult.error };
      }

      if (oldAvatar && this.isStorageAvatar(oldAvatar)) {
        await this.imageUpload.deleteImage(oldAvatar);
      }

      return { success: true, url: result.url };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Avatar upload failed';
      return { success: false, error: message };
    }
  }

  async removeAvatar(): Promise<{ success: boolean; error?: string }> {
    const user = this.supabase.currentUserValue;
    const profile = this._profile();
    if (!user || !profile) {
      return { success: false, error: 'Not authenticated' };
    }

    const currentAvatar = profile.avatar_url;
    const fallbackAvatar = this.getGoogleAvatarFromUser(user);

    try {
      const updateResult = await this.updateProfile({
        avatar_url: profile.auth_provider === 'google' ? fallbackAvatar : null
      });

      if (!updateResult.success) {
        return updateResult;
      }

      if (currentAvatar && this.isStorageAvatar(currentAvatar)) {
        await this.imageUpload.deleteImage(currentAvatar);
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove avatar';
      return { success: false, error: message };
    }
  }

  async updatePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const user = this.supabase.currentUserValue;
    if (!user?.email) {
      return { success: false, error: 'Not authenticated' };
    }

    if (this.authProvider() !== 'email') {
      return { success: false, error: 'Password changes are only available for email accounts' };
    }

    try {
      const { error: signInError } = await this.supabase.db.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      const { error: updateError } = await this.supabase.db.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update password';
      return { success: false, error: message };
    }
  }

  getAuthProvider(): AuthProvider {
    return this.authProvider();
  }

  private async createProfileFromUser(user: User): Promise<UserProfile> {
    const provider = this.inferProviderFromUser(user);
    const fullName = this.getMetadataString(user, 'full_name') ?? this.getMetadataString(user, 'name');
    const displayName = fullName ?? (user.email ? user.email.split('@')[0] : 'User');
    const avatarUrl = this.getGoogleAvatarFromUser(user);

    const payload = {
      user_id: user.id,
      email: user.email ?? '',
      display_name: displayName,
      full_name: fullName,
      avatar_url: avatarUrl,
      auth_provider: provider
    };

    const { data, error } = await this.supabase.db
      .from('user_profiles')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as UserProfile;
  }

  private async syncAuthMetadata(profile: UserProfile): Promise<void> {
    const { error } = await this.supabase.db.auth.updateUser({
      data: {
        display_name: profile.display_name,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url
      }
    });

    if (error) {
      console.warn('Could not sync auth metadata:', error.message);
    }
  }

  private inferProviderFromUser(user: User | null): AuthProvider {
    if (!user) {
      return 'email';
    }
    const provider = user.app_metadata?.['provider'] as string | undefined;
    return provider === 'google' ? 'google' : 'email';
  }

  private getMetadataString(user: User, key: string): string | null {
    const value = user.user_metadata?.[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private getGoogleAvatarFromUser(user: User): string | null {
    return (
      this.getMetadataString(user, 'avatar_url') ??
      this.getMetadataString(user, 'picture')
    );
  }

  private isStorageAvatar(url: string): boolean {
    return url.includes('/storage/v1/object/public/images/');
  }
}
