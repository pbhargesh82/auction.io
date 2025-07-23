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
    return this._players().filter(p => p.auction_status === 'PENDING' && p.is_active);
  });

  soldPlayers = computed(() => {
    return this._auctionHistory().filter(h => h.status === 'SOLD');
  });

  totalPlayers = computed(() => {
    return this.playerQueue().length;
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
    // Set up real-time subscriptions
    this.setupRealtimeSubscriptions();
  }

  // Load all auction data
  async loadAllData() {
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
        this.loadAuctionConfig(),
        this.loadTeams(),
        this.loadPlayers(),
        this.loadAuctionHistory(),
        this.loadTeamPlayers()
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
  async loadAuctionConfig() {
    const { data, error } = await this.supabase.db
      .from('auction_config')
      .select('*')
      .single();
    
    if (error) throw error;
    return { data, error: null };
  }

  async loadTeams() {
    const { data, error } = await this.supabase.db
      .from('teams')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return { data, error: null };
  }

  async loadPlayers() {
    const { data, error } = await this.supabase.db
      .from('players')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return { data, error: null };
  }

  async loadAuctionHistory() {
    const { data, error } = await this.supabase.db
      .from('auction_history')
      .select(`
        *,
        player:players(*),
        team:teams(*)
      `)
      .order('sold_at', { ascending: false });
    
    if (error) throw error;
    return { data, error: null };
  }

  async loadTeamPlayers() {
    const { data, error } = await this.supabase.db
      .from('team_players')
      .select(`
        *,
        team:teams(*),
        player:players(*)
      `)
      .order('purchased_at', { ascending: false });
    
    if (error) throw error;
    return { data, error: null };
  }

  async loadCurrentPlayer() {
    const players = this._players();
    const currentPlayer = players.find(p => p.auction_status === 'CURRENT');
    this._currentPlayer.set(currentPlayer || null);
  }

  // Update methods
  async updatePlayerAuctionStatus(playerId: string, status: 'PENDING' | 'CURRENT' | 'SOLD' | 'UNSOLD' | 'SKIPPED' | 'INACTIVE') {
    const { data, error } = await this.supabase.db
      .from('players')
      .update({ 
        auction_status: status,
        // Also update is_sold for consistency with database trigger
        is_sold: status === 'SOLD'
      })
      .eq('id', playerId)
      .select()
      .single();

    if (error) throw error;

    // Update local state
    this._players.update(players => 
      players.map(p => p.id === playerId ? { ...p, auction_status: status, is_sold: status === 'SOLD' } : p)
    );

    // Update current player immediately based on the updated status
    if (status === 'CURRENT') {
      const updatedPlayer = this._players().find(p => p.id === playerId);
      this._currentPlayer.set(updatedPlayer || null);
    } else if (status === 'SOLD' || status === 'UNSOLD' || status === 'SKIPPED') {
      // If current player was sold/unsold/skipped, find the next current player
      const nextCurrentPlayer = this._players().find(p => p.auction_status === 'CURRENT');
      this._currentPlayer.set(nextCurrentPlayer || null);
    }

    return { data, error: null };
  }

  async addBidToHistory(historyData: any) {
    const { data, error } = await this.supabase.db
      .from('auction_history')
      .insert([historyData])
      .select(`
        *,
        player:players(*),
        team:teams(*)
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
    const { data, error } = await this.supabase.db
      .from('players')
      .update({ auction_status: 'PENDING' })
      .in('id', playerIds)
      .select();

    if (error) throw error;

    // Update local state
    this._players.update(players => 
      players.map(p => 
        playerIds.includes(p.id) ? { ...p, auction_status: 'PENDING' } : p
      )
    );

    return { data, error: null };
  }

  async removePlayersFromAuction(playerIds: string[]) {
    const { data, error } = await this.supabase.db
      .from('players')
      .update({ auction_status: 'INACTIVE' })
      .in('id', playerIds)
      .select();

    if (error) throw error;

    // Update local state
    this._players.update(players => 
      players.map(p => 
        playerIds.includes(p.id) ? { ...p, auction_status: 'INACTIVE' } : p
      )
    );

    return { data, error: null };
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

      // 1. Reset auction config
      const { error: configError } = await this.supabase.db
        .from('auction_config')
        .update({ 
          status: 'DRAFT',
          current_player_id: null,
          current_player_position: 0,
          started_at: null,
          completed_at: null
        })
        .eq('id', config.id);

      if (configError) throw configError;

      // 2. Reset all players to PENDING status
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

  // Real-time subscriptions
  private setupRealtimeSubscriptions() {
    // Auction config changes
    this.supabase.db
      .channel('auction-config-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'auction_config' },
        () => this.loadAuctionConfig().then(result => this._auctionConfig.set(result.data))
      )
      .subscribe();

    // Players changes
    this.supabase.db
      .channel('players-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'players' },
        () => this.loadPlayers().then(result => {
          this._players.set(result.data || []);
          this.loadCurrentPlayer();
        })
      )
      .subscribe();

    // Auction history changes
    this.supabase.db
      .channel('auction-history-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'auction_history' },
        () => this.loadAuctionHistory().then(result => this._auctionHistory.set(result.data || []))
      )
      .subscribe();

    // Team players changes
    this.supabase.db
      .channel('team-players-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'team_players' },
        () => this.loadTeamPlayers().then(result => this._teamPlayers.set(result.data || []))
      )
      .subscribe();

    // Teams changes
    this.supabase.db
      .channel('teams-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'teams' },
        () => this.loadTeams().then(result => this._teams.set(result.data || []))
      )
      .subscribe();
  }

  // Clear error
  clearError() {
    this._error.set(null);
  }
} 