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
 *   • resetAuction(id) → { error }
 *   • getPublicAuction(slug) → { data, error }  (no-auth)
 */
@Injectable({ providedIn: 'root' })
export class AuctionsService {
  readonly auctions = signal<Auction[]>([]);
  readonly loading  = signal(false);

  constructor(private supabase: SupabaseService) {}

  /** Load all auctions owned by the current user. */
  async loadAuctions(): Promise<void> {
    const user = this.supabase.currentUserValue;
    if (!user) {
      this.auctions.set([]);
      return;
    }

    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.db
        .from('auctions')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Failed to load auctions:', error.message);
        this.auctions.set([]);
      } else {
        this.auctions.set((data ?? []) as Auction[]);
      }
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
   * Fully reset one auction's progress while keeping teams and the player pool.
   *
   * - Sets status to `draft` and clears current-player pointers
   * - Resets auction_players to available (clears sold price / team)
   * - Removes team_players assignments and zeros team budgets/counts
   * - Deletes auction_history for this auction
   */
  async resetAuction(auctionId: string): Promise<{ error: Error | null }> {
    if (!auctionId) {
      return { error: new Error('Auction ID is required') };
    }

    try {
      const { error: auctionError } = await this.supabase.db
        .from('auctions')
        .update({
          status: 'draft',
          current_player_id: null,
          current_player_position: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', auctionId);
      if (auctionError) throw auctionError;

      const { error: playersError } = await this.supabase.db
        .from('auction_players')
        .update({
          status: 'available',
          sold_price: null,
          assigned_team_id: null,
        })
        .eq('auction_id', auctionId);
      if (playersError) throw playersError;

      const { data: teams, error: teamsLoadError } = await this.supabase.db
        .from('teams')
        .select('id')
        .eq('auction_id', auctionId);
      if (teamsLoadError) throw teamsLoadError;

      const teamIds = (teams ?? []).map((t: { id: string }) => t.id);
      if (teamIds.length > 0) {
        const { error: teamPlayersError } = await this.supabase.db
          .from('team_players')
          .delete()
          .in('team_id', teamIds);
        if (teamPlayersError) throw teamPlayersError;

        const { error: teamsResetError } = await this.supabase.db
          .from('teams')
          .update({ budget_spent: 0, players_count: 0 })
          .in('id', teamIds);
        if (teamsResetError) throw teamsResetError;
      }

      // Also clear any team_players rows scoped by auction_id (if column present)
      const { error: scopedTeamPlayersError } = await this.supabase.db
        .from('team_players')
        .delete()
        .eq('auction_id', auctionId);
      if (scopedTeamPlayersError && scopedTeamPlayersError.code !== '42703') {
        throw scopedTeamPlayersError;
      }

      const { error: historyError } = await this.supabase.db
        .from('auction_history')
        .delete()
        .eq('auction_id', auctionId);
      if (historyError) throw historyError;

      await this.loadAuctions();
      return { error: null };
    } catch (err: any) {
      console.error('Failed to reset auction:', err);
      return { error: err instanceof Error ? err : new Error(err?.message || 'Failed to reset auction') };
    }
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
