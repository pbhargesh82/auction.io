import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';

export type UserRole = 'super_admin' | 'user';

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
          detectSessionInUrl: true,
          flowType: 'pkce'
        }
      }
    );

    this.initializeAuth();
  }

  private hasAuthTokensInUrl(): boolean {
    const hash = window.location.hash;
    const search = window.location.search;
    return (
      hash.includes('access_token=') ||
      hash.includes('error=') ||
      search.includes('code=')
    );
  }

  private stripAuthFromUrl(): void {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  private async recoverSessionFromUrl(): Promise<void> {
    if (!this.hasAuthTokensInUrl()) {
      return;
    }

    const { data: { session }, error } = await this.supabase.auth.getSession();
    if (error) {
      console.error('OAuth URL recovery error:', error);
      return;
    }

    if (session?.user) {
      this._currentUser.next(session.user);
      await this.updateUserRole(session.user);
      this.stripAuthFromUrl();
    }
  }

  private async initializeAuth() {
    await this.recoverSessionFromUrl();

    const { data: { session } } = await this.supabase.auth.getSession();
    this._currentUser.next(session?.user ?? null);
    await this.updateUserRole(session?.user ?? null);
    this._initialized = true;

    // Listen to auth changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      this._currentUser.next(session?.user ?? null);
      this.updateUserRole(session?.user ?? null);
    });
  }

  private async updateUserRole(user: User | null) {
    if (!user) {
      this._userRole.next('user');
      return;
    }

    // ALWAYS fetch role from user_roles table first (most authoritative)
    try {
      const { data, error } = await this.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();  // Use maybeSingle to handle no rows

      console.log('DB role query result:', { data, error, userId: user.id });

      if (error) {
        console.error('Error fetching role from DB:', error);
      }

      if (data && !error) {
        const dbRole = data.role as UserRole;
        this._userRole.next(dbRole);
        console.log(`User role from database: ${dbRole} for email: ${user.email}`);
        return;
      }
    } catch (err) {
      console.warn('Could not fetch role from database:', err);
    }

    // Fallback: check JWT app_metadata (may be stale)
    const jwtRole = user.app_metadata?.['role'] as UserRole;
    if (jwtRole && (jwtRole === 'super_admin' || jwtRole === 'user')) {
      this._userRole.next(jwtRole);
      console.log(`User role from JWT: ${jwtRole} for email: ${user.email}`);
      return;
    }

    // Default to 'user' if no role found
    this._userRole.next('user');
    console.log(`User role defaulted to 'user' for email: ${user.email}`);
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
        observer.next(role === 'super_admin');
      });
    });
  }

  get isAdminValue(): boolean {
    return this._userRole.value === 'super_admin';
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
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
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
    const redirectUrl = `${window.location.origin}/auth/callback`;

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

  async waitForOAuthSession(timeoutMs = 10000): Promise<{ user: User | null; error: Error | null }> {
    await this.waitForAuthInitialization();

    if (this._currentUser.value) {
      return { user: this._currentUser.value, error: null };
    }

    await this.recoverSessionFromUrl();

    if (this._currentUser.value) {
      return { user: this._currentUser.value, error: null };
    }

    const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
    if (sessionError) {
      return { user: null, error: sessionError };
    }
    if (session?.user) {
      return { user: session.user, error: null };
    }

    return new Promise((resolve) => {
      let subscription: { unsubscribe: () => void } | undefined;

      const timeout = setTimeout(() => {
        subscription?.unsubscribe();
        resolve({ user: null, error: new Error('OAuth session timeout') });
      }, timeoutMs);

      const { data } = this.supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          clearTimeout(timeout);
          subscription?.unsubscribe();
          resolve({ user: session.user, error: null });
        }
      });
      subscription = data.subscription;
    });
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