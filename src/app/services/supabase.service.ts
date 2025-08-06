import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';

export type UserRole = 'admin' | 'user';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private _currentUser: BehaviorSubject<User | null> = new BehaviorSubject<User | null>(null);
  private _userRole: BehaviorSubject<UserRole> = new BehaviorSubject<UserRole>('user');
  private _initialized = false;

  constructor() {
    console.log('environment', environment);
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.anonKey,
      {
        auth: {
          storage: window.localStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true // Enable automatic session detection from URL
        }
      }
    );

    this.initializeAuth();
  }

  private async initializeAuth() {
    // Get the current session on initialization
    const { data: { session } } = await this.supabase.auth.getSession();
    this._currentUser.next(session?.user ?? null);
    this.updateUserRole(session?.user ?? null);
    this._initialized = true;

    // Listen to auth changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      this._currentUser.next(session?.user ?? null);
      this.updateUserRole(session?.user ?? null);
    });
  }

  private updateUserRole(user: User | null) {
    if (!user?.email) {
      this._userRole.next('user');
      return;
    }
    
    // Determine role based on email
    const role: UserRole = user.email === 'pbhargesh82@aol.com' ? 'admin' : 'user';
    this._userRole.next(role);
    console.log(`User role determined: ${role} for email: ${user.email}`);
  }

  get currentUser(): Observable<User | null> {
    return this._currentUser.asObservable();
  }

  get currentUserValue(): User | null {
    return this._currentUser.value;
  }

  get userRole(): Observable<UserRole> {
    return this._userRole.asObservable();
  }

  get userRoleValue(): UserRole {
    return this._userRole.value;
  }

  get isAdmin(): Observable<boolean> {
    return new Observable(observer => {
      this._userRole.subscribe(role => {
        observer.next(role === 'admin');
      });
    });
  }

  get isAdminValue(): boolean {
    return this._userRole.value === 'admin';
  }

  // Wait for auth initialization to complete
  async waitForAuthInitialization(): Promise<User | null> {
    if (this._initialized) {
      return this._currentUser.value;
    }
    
    // Wait for the first emission after initialization
    return firstValueFrom(
      this._currentUser.pipe(
        filter(() => this._initialized),
        take(1)
      )
    );
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  // Auth methods
  async signUp(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password
    });
    return { data, error };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  }

  async signInWithGoogle() {
    // Temporary workaround: Force localhost for local development
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const redirectUrl = isLocalhost 
      ? 'http://localhost:4200/auth/callback'
      : environment.auth.redirectUrl;
    
    console.log('Using redirect URL:', redirectUrl);
    console.log('Current hostname:', window.location.hostname);
    
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });
    return { data, error };
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    return { error };
  }

  async resetPassword(email: string) {
    const { data, error } = await this.supabase.auth.resetPasswordForEmail(email);
    return { data, error };
  }

  // Handle OAuth callback
  async handleAuthCallback() {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
      return { error };
    }
    return { data };
  }

  // Database methods
  get db() {
    return this.supabase;
  }

  // Real-time subscriptions
  createRealtimeChannel(tableName: string) {
    return this.supabase
      .channel(`${tableName}-changes`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: tableName },
        (payload) => {
          console.log('Change received!', payload);
        }
      );
  }

  // Storage methods
  uploadFile(bucket: string, filePath: string, file: File) {
    return this.supabase.storage
      .from(bucket)
      .upload(filePath, file);
  }

  getPublicUrl(bucket: string, filePath: string) {
    return this.supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);
  }
} 