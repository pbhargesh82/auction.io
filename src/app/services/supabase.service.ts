import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private _currentUser: BehaviorSubject<User | null> = new BehaviorSubject<User | null>(null);

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.anonKey
    );

    // Listen to auth changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      this._currentUser.next(session?.user ?? null);
    });
  }

  get currentUser(): Observable<User | null> {
    return this._currentUser.asObservable();
  }

  get currentUserValue(): User | null {
    return this._currentUser.value;
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

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    return { error };
  }

  async resetPassword(email: string) {
    const { data, error } = await this.supabase.auth.resetPasswordForEmail(email);
    return { data, error };
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