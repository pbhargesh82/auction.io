import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { BehaviorSubject, Observable } from 'rxjs';

export interface AuctionConfig {
  id: string;
  name: string;
  description?: string;
  budget_cap: number;
  max_players_per_team: number;
  min_players_per_team: number;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
  current_player_id?: string;
  current_player_position: number;
  total_players: number;
  // auction_type field removed - timer functionality will be per-player, not per-auction
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}

// PlayerQueue interface removed - using players table directly

export interface AuctionHistory {
  id: string;
  player_id: string;
  winning_team_id?: string;
  final_price?: number;
  auction_date: string;
  sold_at: string;
  auction_round?: number;
  bidding_duration?: string;
  notes?: string;
  status: 'SOLD' | 'UNSOLD' | 'WITHDRAWN';
  player?: any;
  team?: any;
}

export interface CreateAuctionConfigData {
  name: string;
  description?: string;
  budget_cap: number;
  max_players_per_team: number;
  min_players_per_team?: number;
  // auction_type field removed - timer functionality will be per-player, not per-auction
}

export interface UpdateAuctionConfigData {
  name?: string;
  description?: string;
  budget_cap?: number;
  max_players_per_team?: number;
  min_players_per_team?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
  current_player_id?: string;
  current_player_position?: number;
  total_players?: number;
  // auction_type field removed - timer functionality will be per-player, not per-auction
}

@Injectable({
  providedIn: 'root'
})
export class AuctionService {
  private currentAuctionSubject = new BehaviorSubject<AuctionConfig | null>(null);
  // Player queue subject removed - using players table directly
  private auctionHistorySubject = new BehaviorSubject<AuctionHistory[]>([]);

  public currentAuction$ = this.currentAuctionSubject.asObservable();
  // Player queue observable removed - using players table directly
  public auctionHistory$ = this.auctionHistorySubject.asObservable();

  constructor(private supabase: SupabaseService) {}

  // Auction Configuration Methods
  async getAuctionConfig(): Promise<{ data: AuctionConfig | null, error: any }> {
    try {
      const { data, error } = await this.supabase.db
        .from('auction_config')
        .select('*')
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching auction config:', error);
      return { data: null, error };
    }
  }

  async createAuctionConfig(configData: CreateAuctionConfigData): Promise<{ data: AuctionConfig | null, error: any }> {
    try {
      const { data, error } = await this.supabase.db
        .from('auction_config')
        .insert([configData])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating auction config:', error);
      return { data: null, error };
    }
  }

  async updateAuctionConfig(id: string, updateData: UpdateAuctionConfigData): Promise<{ data: AuctionConfig | null, error: any }> {
    try {
      const { data, error } = await this.supabase.db
        .from('auction_config')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating auction config:', error);
      return { data: null, error };
    }
  }

  async deleteAuctionConfig(id: string): Promise<{ error: any }> {
    try {
      const { error } = await this.supabase.db
        .from('auction_config')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting auction config:', error);
      return { error };
    }
  }

  // Player Queue Methods - REMOVED
  // All player queue functionality has been moved to the players table
  // Use auction-state.service.ts for player queue operations

  // Auction History Methods - Updated to match actual schema
  async getAuctionHistory(): Promise<{ data: AuctionHistory[] | null, error: any }> {
    try {
      const { data, error } = await this.supabase.db
        .from('auction_history')
        .select(`
          *,
          player:players(*),
          team:teams!auction_history_winning_team_id_fkey(*)
        `)
        .order('sold_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching auction history:', error);
      return { data: null, error };
    }
  }

  async addBidToHistory(historyData: Omit<AuctionHistory, 'id' | 'sold_at'>): Promise<{ data: AuctionHistory | null, error: any }> {
    try {
      const { data, error } = await this.supabase.db
        .from('auction_history')
        .insert([historyData])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error adding bid to history:', error);
      return { data: null, error };
    }
  }

  async clearAuctionHistory(): Promise<{ error: any }> {
    try {
      const { error } = await this.supabase.db
        .from('auction_history')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (error) throw error;
      
      // Update the subject
      this.auctionHistorySubject.next([]);
      
      return { error: null };
    } catch (error) {
      console.error('Error clearing auction history:', error);
      return { error };
    }
  }

  // Auction Control Methods
  async startAuction(): Promise<{ data: AuctionConfig | null, error: any }> {
    try {
      // First, get the current auction config
      const { data: currentConfig } = await this.getAuctionConfig();
      if (!currentConfig) {
        throw new Error('No auction config found');
      }

      // Update the auction to ACTIVE status regardless of current status
      const { data, error } = await this.supabase.db
        .from('auction_config')
        .update({ 
          status: 'ACTIVE',
          started_at: new Date().toISOString()
        })
        .eq('id', currentConfig.id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error starting auction:', error);
      return { data: null, error };
    }
  }

  // pauseAuction method removed - not needed for manual auction control

  async endAuction(): Promise<{ data: AuctionConfig | null, error: any }> {
    try {
      // First, get the current auction config
      const { data: currentConfig } = await this.getAuctionConfig();
      if (!currentConfig) {
        throw new Error('No auction config found');
      }

      // Update the auction to COMPLETED status regardless of current status
      const { data, error } = await this.supabase.db
        .from('auction_config')
        .update({ 
          status: 'COMPLETED',
          completed_at: new Date().toISOString()
        })
        .eq('id', currentConfig.id)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error ending auction:', error);
      return { data: null, error };
    }
  }

  async resetAuction(): Promise<{ data: AuctionConfig | null, error: any }> {
    try {
      // Start a transaction to ensure all operations succeed or fail together
      const { data: config } = await this.getAuctionConfig();
      if (!config) {
        throw new Error('No auction config found');
      }

      // 1. Reset auction config to DRAFT status
      const { data: updatedConfig, error: configError } = await this.supabase.db
        .from('auction_config')
        .update({ 
          status: 'DRAFT',
          current_player_id: null,
          current_player_position: 0,
          started_at: null,
          completed_at: null
        })
        .eq('id', config.id)
        .select()
        .single();

      if (configError) throw configError;

      // 2. Reset all player auction statuses to PENDING
      const { error: auctionStatusError } = await this.supabase.db
        .from('players')
        .update({ auction_status: 'PENDING' })
        .in('auction_status', ['CURRENT', 'SOLD', 'UNSOLD', 'SKIPPED']);

      if (auctionStatusError) throw auctionStatusError;

      // 3. Clear all auction history
      const { error: historyError } = await this.supabase.db
        .from('auction_history')
        .delete()
        .not('id', 'is', null); // Delete all records

      if (historyError) throw historyError;

      // 4. Reset team budgets and player counts
      const { error: teamsError } = await this.supabase.db
        .from('teams')
        .update({ 
          budget_spent: 0,
          players_count: 0
        })
        .not('id', 'is', null); // Update all teams

      if (teamsError) throw teamsError;

      // 5. Reset all players to unsold status
      const { error: playersError } = await this.supabase.db
        .from('players')
        .update({ is_sold: false })
        .not('id', 'is', null); // Update all players

      if (playersError) throw playersError;

      // 6. Clear all team_players records
      const { error: teamPlayersError } = await this.supabase.db
        .from('team_players')
        .delete()
        .not('id', 'is', null); // Delete all records

      if (teamPlayersError) throw teamPlayersError;

      return { data: updatedConfig, error: null };
    } catch (error) {
      console.error('Error resetting auction:', error);
      return { data: null, error };
    }
  }

  // Real-time subscriptions
  subscribeToAuctionUpdates() {
    return this.supabase.db
      .channel('auction-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'auction_config' },
        (payload: any) => {
          this.currentAuctionSubject.next(payload.new as AuctionConfig);
        }
      )
      // Player queue subscription removed - using players table directly
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'auction_history' },
        (payload: any) => {
          // Refresh auction history when it changes
          this.getAuctionHistory().then(({ data }) => {
            if (data) this.auctionHistorySubject.next(data);
          });
        }
      )
      .subscribe();
  }

  // Utility methods
  async getCurrentAuction(): Promise<{ data: AuctionConfig | null, error: any }> {
    try {
      const { data, error } = await this.supabase.db
        .from('auction_config')
        .select('*')
        .in('status', ['ACTIVE', 'DRAFT'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      this.currentAuctionSubject.next(data);
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching current auction:', error);
      return { data: null, error };
    }
  }

  async loadAuctionData() {
    // Load all auction-related data
    const [configResult, historyResult] = await Promise.all([
      this.getAuctionConfig(),
      this.getAuctionHistory()
    ]);

    if (configResult.data) this.currentAuctionSubject.next(configResult.data);
    if (historyResult.data) this.auctionHistorySubject.next(historyResult.data);

    return {
      config: configResult,
      history: historyResult
    };
  }
} 