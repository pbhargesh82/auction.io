import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Auction {
  id: string;
  owner_id: string;
  name: string;
  public_slug: string;
  description: string | null;
  budget_per_team: number;
  max_players_per_team: number;
  min_players_per_team: number;
  status: 'draft' | 'active' | 'paused' | 'completed';
  current_player_id: string | null;
  current_player_position: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * AuctionsService — Phase 6.
 *
 * Thin data service for the user's auction list (CRUD).
 * Replaces AuctionContextService without carrying the deprecated
 * "selected auction" / localStorage concepts.
 *
 * Public API:
 *   • auctions   — signal<Auction[]>
 *   • loading    — signal<boolean>
 *   • loadAuctions()
 *   • createAuction(partial) → { data, error }
 *   • updateAuction(id, partial) → { error }
 *   • deleteAuction(id) → { error }
 *   • getPublicAuction(slug) → { data, error }  (no-auth)
 */
@Injectable({ providedIn: 'root' })
export class AuctionsService {
  readonly auctions = signal<Auction[]>([]);
  readonly loading  = signal(false);

  constructor(private supabase: SupabaseService) {}

  /** Load all auctions owned by the current user. */
  async loadAuctions(): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.db
        .from('auctions')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) this.auctions.set((data ?? []) as Auction[]);
    } finally {
      this.loading.set(false);
    }
  }

  /** Create a new auction and refresh the list. */
  async createAuction(
    values: Partial<Auction>
  ): Promise<{ data: Auction | null; error: Error | null }> {
    const user = this.supabase.currentUserValue;
    if (!user) return { data: null, error: new Error('Not authenticated') };

    const { data, error } = await this.supabase.db
      .from('auctions')
      .insert({
        owner_id:             user.id,
        name:                 values.name,
        description:          values.description ?? null,
        budget_per_team:      values.budget_per_team      ?? 10_000_000,
        max_players_per_team: values.max_players_per_team ?? 25,
        min_players_per_team: values.min_players_per_team ?? 15,
        status:               'draft',
        is_public:            values.is_public ?? true,
      })
      .select()
      .single();

    if (!error) await this.loadAuctions();
    return { data: data as Auction | null, error: error as unknown as Error };
  }

  /** Update an existing auction and refresh the list. */
  async updateAuction(
    id: string,
    values: Partial<Auction>
  ): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.db
      .from('auctions')
      .update({
        name:                 values.name,
        description:          values.description,
        budget_per_team:      values.budget_per_team,
        max_players_per_team: values.max_players_per_team,
        min_players_per_team: values.min_players_per_team,
        status:               values.status,
        is_public:            values.is_public,
        updated_at:           new Date().toISOString(),
      })
      .eq('id', id);

    if (!error) await this.loadAuctions();
    return { error: error as unknown as Error };
  }

  /** Delete an auction and refresh the list. */
  async deleteAuction(id: string): Promise<{ error: Error | null }> {
    const { error } = await this.supabase.db
      .from('auctions')
      .delete()
      .eq('id', id);

    if (!error) await this.loadAuctions();
    return { error: error as unknown as Error };
  }

  /**
   * Fetch a public auction by slug — no authentication required.
   * Used by PublicAuctionComponent.
   */
  async getPublicAuction(
    slug: string
  ): Promise<{ data: Auction | null; error: Error | null }> {
    const { data, error } = await this.supabase.db
      .from('auctions')
      .select('*')
      .eq('public_slug', slug)
      .eq('is_public', true)
      .single();

    return { data: data as Auction | null, error: error as unknown as Error };
  }
}
