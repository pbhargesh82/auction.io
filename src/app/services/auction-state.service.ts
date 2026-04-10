import { Injectable, signal, computed, effect } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { BehaviorSubject } from 'rxjs';

export interface AuctionState {
  auctionConfig: any;
  currentPlayer: any;
  teams: any[];
  players: any[];
  auctionHistory: any[];
  teamPlayers: any[];
  loading: boolean;
  error: string | null;
}

export interface TeamWithPlayers {
  id: string;
  name: string;
  short_name?: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  budget_cap: number;
  budget_spent: number;
  budget_remaining: number;
  players_count: number;
  max_players: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  players: any[];
}

export interface Player {
  id: string;
  name: string;
  position: string;
  category: string;
  subcategory?: string;
  base_price: number;
  image_url?: string;
  nationality?: string;
  age?: number;
  experience_years?: number;
  stats?: any;
  is_sold: boolean;
  is_active: boolean;
  auction_status: 'PENDING' | 'CURRENT' | 'SOLD' | 'UNSOLD' | 'SKIPPED' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuctionStateService {
  // Centralized state signals
  private _auctionConfig = signal<any>(null);
  private _currentPlayer = signal<any>(null);
  private _teams = signal<any[]>([]);
  private _players = signal<Player[]>([]);
  private _auctionHistory = signal<any[]>([]);
  private _teamPlayers = signal<any[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  // Public signals
  auctionConfig = this._auctionConfig.asReadonly();
  currentPlayer = this._currentPlayer.asReadonly();
  teams = this._teams.asReadonly();
  players = this._players.asReadonly();
  auctionHistory = this._auctionHistory.asReadonly();
  teamPlayers = this._teamPlayers.asReadonly();
  loading = this._loading.asReadonly();
  error = this._error.asReadonly();

  // Computed values
  teamsWithPlayers = computed(() => {
    const teams = this._teams();
    const teamPlayers = this._teamPlayers();

    return teams.map(team => {
      const players = teamPlayers
        .filter(tp => tp.team_id === team.id)
        .map(tp => ({
          ...tp.player,
          purchase_price: tp.purchase_price,
          purchased_at: tp.purchased_at
        }))
        .filter(player => player !== null && player !== undefined);

      return {
        ...team,
        players
      };
    });
  });

  // Player queue computed from players table
  playerQueue = computed(() => {
    return this._players().filter(p =>
      p.auction_status === 'PENDING' ||
      p.auction_status === 'CURRENT' ||
      p.auction_status === 'SOLD' ||
      p.auction_status === 'UNSOLD' ||
      p.auction_status === 'SKIPPED'
    ).sort((a, b) => {
      // Sort by auction status priority, then by name
      const statusOrder: Record<string, number> = {
        'CURRENT': 0,
        'PENDING': 1,
        'SOLD': 2,
        'UNSOLD': 3,
        'SKIPPED': 4,
        'INACTIVE': 5
      };
      const aOrder = statusOrder[a.auction_status] || 6;
      const bOrder = statusOrder[b.auction_status] || 6;
      return aOrder - bOrder;
    });
  });

  availablePlayers = computed(() => {
    // Use same logic as players component: Active players - Sold players
    const activePlayers = this._players().filter(p => p.is_active);
    const soldPlayerIds = this._teamPlayers().map(tp => tp.player_id);
    return activePlayers.filter(p => !soldPlayerIds.includes(p.id));
  });

  soldPlayers = computed(() => {
    // Use team_players table to determine sold players (consistent with players component)
    const soldPlayerIds = this._teamPlayers().map(tp => tp.player_id);
    return this._players().filter(p => soldPlayerIds.includes(p.id));
  });

  totalPlayers = computed(() => {
    return this._players().filter(p => p.is_active).length;
  });

  remainingPlayers = computed(() => {
    return this._players().filter(p => p.auction_status === 'PENDING').length;
  });

  progressPercentage = computed(() => {
    const total = this.totalPlayers();
    const sold = this.soldPlayers().length;
    return total > 0 ? Math.round((sold / total) * 100) : 0;
  });

  constructor(private supabase: SupabaseService) {
    // Subscriptions are now managed via loadAllData or manual calls
  }

  private activeChannels: any[] = [];

  // Load all auction data for a specific auction or the current context
  async loadAllData(auctionId?: string) {
    this._loading.set(true);
    this._error.set(null);

    try {
      const [
        configResult,
        teamsResult,
        playersResult,
        historyResult,
        teamPlayersResult
      ] = await Promise.all([
        this.loadAuctionConfig(auctionId),
        this.loadTeams(auctionId),
        this.loadPlayers(auctionId),
        this.loadAuctionHistory(auctionId),
        this.loadTeamPlayers(auctionId)
      ]);

      // Update signals
      this._auctionConfig.set(configResult.data);
      this._teams.set(teamsResult.data || []);
      this._players.set(playersResult.data || []);
      this._auctionHistory.set(historyResult.data || []);
      this._teamPlayers.set(teamPlayersResult.data || []);

      // Load current player
      await this.loadCurrentPlayer();

    } catch (error: any) {
      this._error.set(error.message);
      console.error('Error loading auction data:', error);
    } finally {
      this._loading.set(false);
    }
  }

  // Individual load methods
  async loadAuctionConfig(auctionId?: string) {
    let query = this.supabase.db.from('auctions').select('*');
    
    if (auctionId) {
      query = query.eq('id', auctionId);
    } else {
      // Fallback to legacy auction_config or first auction if no ID provided
      const { data: legacyConfig } = await this.supabase.db
        .from('auction_config')
        .select('*')
        .maybeSingle();
      
      if (legacyConfig) return { data: legacyConfig, error: null };
      
      // If no legacy, just get the most recent auction
      query = query.order('created_at', { ascending: false }).limit(1);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Error loading auction config:', error);
      return { data: null, error };
    }
    return { data, error: null };
  }

  async loadTeams(auctionId?: string) {
    let query = this.supabase.db
      .from('teams')
      .select('*')
      .eq('is_active', true);
    
    if (auctionId) {
      query = query.eq('auction_id', auctionId);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;
    return { data, error: null };
  }

  async loadPlayers(auctionId?: string) {
    if (auctionId) {
      // Load players for specific auction via junction table
      const { data, error } = await this.supabase.db
        .from('auction_players')
        .select(`
          *,
          player:players(*)
        `)
        .eq('auction_id', auctionId);
      
      if (error) throw error;
      
      // Map to Player-like objects for compatibility
      const mappedPlayers = (data || []).map(ap => {
        let mappedStatus = ap.status.toUpperCase();
        if (ap.status === 'available') mappedStatus = 'PENDING';

        // Defensively grab the player object (handles array wrap or alternate alias)
        const rawPlayer = ap.player || ap.players;
        const playerObj = Array.isArray(rawPlayer) ? rawPlayer[0] : rawPlayer;

        return {
          ...(playerObj || {}),
          // We must override id explicitly if we are missing it or to ensure we have the correct id.
          // Actually, we want the player.id to remain the id, not auction_players.id
          id: playerObj?.id, 
          auction_player_id: ap.id,
          auction_status: mappedStatus,
          base_price: ap.base_price,
          is_sold: ap.status === 'sold'
        };
      });
      
      return { data: mappedPlayers, error: null };
    }

    // Legacy/Global fallback
    const { data, error } = await this.supabase.db
      .from('players')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return { data, error: null };
  }

  async loadAuctionHistory(auctionId?: string) {
    let query = this.supabase.db
      .from('auction_history')
      .select(`
        *,
        player:players(*),
        team:teams!auction_history_winning_team_id_fkey(*)
      `);
    
    if (auctionId) {
      query = query.eq('auction_id', auctionId);
    }

    const { data, error } = await query.order('sold_at', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  }

  async loadTeamPlayers(auctionId?: string) {
    let query = this.supabase.db
      .from('team_players')
      .select(`
        *,
        team:teams(*),
        player:players(*)
      `);
    
    if (auctionId) {
      query = query.eq('auction_id', auctionId);
    }

    const { data, error } = await query.order('purchased_at', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  }

  async loadCurrentPlayer() {
    const players = this._players();
    const config = this._auctionConfig();
    
    // 1. Primary Source of Truth: The current_player_id in the auction config
    if (config?.current_player_id) {
      const currentPlayer = players.find(p => p.id === config.current_player_id);
      if (currentPlayer) {
        this._currentPlayer.set(currentPlayer);
        return;
      }
    }

    // 2. Fallback: Search for any player with CURRENT status
    const currentPlayer = players.find(p => p.auction_status === 'CURRENT');
    this._currentPlayer.set(currentPlayer || null);
  }

  // Update methods
  async updatePlayerAuctionStatus(playerId: string, status: 'PENDING' | 'CURRENT' | 'SOLD' | 'UNSOLD' | 'SKIPPED' | 'INACTIVE') {
    const auctionConfig = this._auctionConfig();
    const auctionId = auctionConfig?.id;
    let resultData: any = null;

    if (auctionId) {
      let mappedStatus = status.toLowerCase();
      if (status === 'PENDING') mappedStatus = 'available';

      // 1. If we are setting a new player to CURRENT, we must ensure exclusive status
      if (status === 'CURRENT') {
        // Clear status from any other player in this auction who might be 'current'
        await this.supabase.db
          .from('auction_players')
          .update({ status: 'available' })
          .eq('auction_id', auctionId)
          .eq('status', 'current')
          .not('player_id', 'eq', playerId);
        
        // Update the auction record itself to set the current_player_id
        await this.supabase.db
          .from('auctions')
          .update({ current_player_id: playerId })
          .eq('id', auctionId);
      } 
      
      // 2. If the current player is being SOLD or marked UNSOLD/SKIPPED, clear the auction's current_player_id
      if (status === 'SOLD' || status === 'UNSOLD' || status === 'SKIPPED') {
        if (auctionConfig.current_player_id === playerId) {
          await this.supabase.db
            .from('auctions')
            .update({ current_player_id: null })
            .eq('id', auctionId);
        }
      }

      // 3. Update the specific player status
      const { data, error } = await this.supabase.db
        .from('auction_players')
        .update({ status: mappedStatus })
        .eq('auction_id', auctionId)
        .eq('player_id', playerId)
        .select()
        .single();

      if (error) throw error;
      resultData = data;
    } else {
      const { data, error } = await this.supabase.db
        .from('players')
        .update({
          auction_status: status,
          is_sold: status === 'SOLD'
        })
        .eq('id', playerId)
        .select()
        .single();

      if (error) throw error;
      resultData = data;
    }

    // Update local state and current player
    await this.loadAllData(auctionId);

    return { data: resultData, error: null };
  }

  async addBidToHistory(historyData: any) {
    const { data, error } = await this.supabase.db
      .from('auction_history')
      .insert([historyData])
      .select(`
        *,
        player:players(*),
        team:teams!auction_history_winning_team_id_fkey(*)
      `)
      .single();

    if (error) throw error;

    // Update local state
    this._auctionHistory.update(history => [data, ...history]);

    return { data, error: null };
  }

  async assignPlayerToTeam(assignmentData: any) {
    const { data, error } = await this.supabase.db
      .from('team_players')
      .insert([assignmentData])
      .select(`
        *,
        team:teams(*),
        player:players(*)
      `)
      .single();

    if (error) throw error;

    // The database trigger will automatically update team budget and player count
    // We just need to reload the teams data to get the updated values
    const { data: updatedTeams } = await this.loadTeams();
    if (updatedTeams) {
      this._teams.set(updatedTeams);
    }

    // Update local state
    this._teamPlayers.update(teamPlayers => [data, ...teamPlayers]);

    return { data, error: null };
  }

  // Player management methods
  async addPlayersToAuction(playerIds: string[]) {
    const auctionConfig = this._auctionConfig();
    const auctionId = auctionConfig?.id;
    let resultData: any = null;
    
    if (auctionId) {
      // First get players to add their base price
      const { data: playersToAdd, error: playersError } = await this.supabase.db
        .from('players')
        .select('id, base_price')
        .in('id', playerIds);
        
      if (playersError) throw playersError;
        
      const auctionPlayersInsert = playersToAdd.map((p, idx) => ({
        auction_id: auctionId,
        player_id: p.id,
        status: 'available',
        base_price: p.base_price,
        auction_order: idx + 1
      }));
      
      const { data, error } = await this.supabase.db
        .from('auction_players')
        .upsert(auctionPlayersInsert, { onConflict: 'auction_id, player_id' })
        .select();

      if (error) throw error;
      resultData = data;
    } else {
      const { data, error } = await this.supabase.db
        .from('players')
        .update({ auction_status: 'PENDING' })
        .in('id', playerIds)
        .select();

      if (error) throw error;
      resultData = data;
    }

    // Update local state
    this._players.update(players =>
      players.map(p =>
        playerIds.includes(p.id) ? { ...p, auction_status: 'PENDING' } : p
      )
    );

    return { data: resultData, error: null };
  }

  async removePlayersFromAuction(playerIds: string[]) {
    const auctionConfig = this._auctionConfig();
    const auctionId = auctionConfig?.id;
    let resultData: any = null;
    
    if (auctionId) {
      const { data, error } = await this.supabase.db
        .from('auction_players')
        .delete()
        .eq('auction_id', auctionId)
        .in('player_id', playerIds)
        .select();

      if (error) throw error;
      resultData = data;
    } else {
      const { data, error } = await this.supabase.db
        .from('players')
        .update({ auction_status: 'INACTIVE' })
        .in('id', playerIds)
        .select();

      if (error) throw error;
      resultData = data;
    }

    // Update local state
    this._players.update(players =>
      players.map(p =>
        playerIds.includes(p.id) ? { ...p, auction_status: 'INACTIVE' } : p
      )
    );

    return { data: resultData, error: null };
  }

  async getNextPlayer() {
    const players = this._players();
    const nextPlayer = players.find(p => p.auction_status === 'PENDING');

    if (nextPlayer) {
      await this.updatePlayerAuctionStatus(nextPlayer.id, 'CURRENT');
      return nextPlayer;
    }

    // No more pending players, clear current player
    this._currentPlayer.set(null);
    return null;
  }

  // Reset auction
  async resetAuction() {
    this._loading.set(true);
    this._error.set(null);

    try {
      // Get current auction config
      const { data: config } = await this.loadAuctionConfig();
      if (!config) {
        throw new Error('No auction config found');
      }

      // 1. Reset auction status
      const { error: configError } = await this.supabase.db
        .from('auctions')
        .update({
          status: 'draft',
          current_player_id: null,
          current_player_position: 0
        })
        .eq('id', config.id);

      // Fallback for legacy auction_config
      if (configError && configError.code === '42P01') {
        const { error: legacyConfigError } = await this.supabase.db
          .from('auction_config')
          .update({
            status: 'DRAFT',
            current_player_id: null,
            current_player_position: 0
          })
          .eq('id', config.id);
        if (legacyConfigError) throw legacyConfigError;
      } else if (configError) {
        throw configError;
      }

      // 2. Reset auction_players status to 'available'
      const { error: apError } = await this.supabase.db
        .from('auction_players')
        .update({
          status: 'available',
          sold_price: null,
          assigned_team_id: null
        })
        .eq('auction_id', config.id);
        
      if (apError && apError.code !== '42P01') throw apError;

      // Reset legacy players to PENDING status
      const { error: playersError } = await this.supabase.db
        .from('players')
        .update({
          auction_status: 'PENDING',
          is_sold: false
        })
        .not('id', 'is', null);

      if (playersError) throw playersError;

      // 3. Clear auction history
      const { error: historyError } = await this.supabase.db
        .from('auction_history')
        .delete()
        .not('id', 'is', null);

      if (historyError) throw historyError;

      // 4. Clear team players
      const { error: teamPlayersError } = await this.supabase.db
        .from('team_players')
        .delete()
        .not('id', 'is', null);

      if (teamPlayersError) throw teamPlayersError;

      // 5. Reset team budgets
      const { error: teamsError } = await this.supabase.db
        .from('teams')
        .update({
          budget_spent: 0,
          players_count: 0
        })
        .not('id', 'is', null);

      if (teamsError) throw teamsError;

      // Reload all data
      await this.loadAllData();

    } catch (error: any) {
      this._error.set(error.message);
      throw error;
    } finally {
      this._loading.set(false);
    }
  }

  // Real-time subscriptions optimized for multi-tenant (Consolidated into single channel)
  setupRealtimeSubscriptions(auctionId?: string) {
    this.stopRealtimeSubscriptions();

    const channel = this.supabase.db
      .channel(`auction-scope-${auctionId || 'global'}`)
      // 1. Auction Row updates
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'auctions', filter: auctionId ? `id=eq.${auctionId}` : undefined },
        () => {
          this.loadAuctionConfig(auctionId).then(result => {
            this._auctionConfig.set(result.data);
            // Trigger a full refresh specifically on auction config changes
            this.loadAllData(auctionId);
          });
        }
      )
      // 2. Player Status updates (Junction table)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'auction_players', filter: auctionId ? `auction_id=eq.${auctionId}` : undefined },
        () => this.loadPlayers(auctionId).then(result => {
          this._players.set(result.data || []);
          this.loadCurrentPlayer();
        })
      )
      // 3. History updates (Recent transactions)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'auction_history', filter: auctionId ? `auction_id=eq.${auctionId}` : undefined },
        () => this.loadAuctionHistory(auctionId).then(result => this._auctionHistory.set(result.data || []))
      )
      // 4. Team Player assignments (Standings)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'team_players', filter: auctionId ? `auction_id=eq.${auctionId}` : undefined },
        () => {
          this.loadTeamPlayers(auctionId).then(result => this._teamPlayers.set(result.data || []));
          this.loadTeams(auctionId).then(result => this._teams.set(result.data || []));
        }
      )
      // 5. Team base data updates
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: auctionId ? `auction_id=eq.${auctionId}` : undefined },
        () => this.loadTeams(auctionId).then(result => this._teams.set(result.data || []))
      )
      .subscribe();

    this.activeChannels.push(channel);
  }

  stopRealtimeSubscriptions() {
    this.activeChannels.forEach(channel => this.supabase.db.removeChannel(channel));
    this.activeChannels = [];
  }

  // Clear error
  clearError() {
    this._error.set(null);
  }
} 