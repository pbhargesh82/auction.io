import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface TeamPlayer {
  id: string;
  team_id: string;
  player_id: string;
  purchase_price: number;
  purchased_at: string;
  position_in_team?: string;
  is_captain: boolean;
  is_vice_captain: boolean;
  // Joined data
  team?: {
    id: string;
    name: string;
    short_name?: string;
    primary_color: string;
  };
  players?: {
    id: string;
    name: string;
    position: string;
    category: string;
  };
}

export interface AssignPlayerToTeamData {
  team_id: string;
  player_id: string;
  purchase_price: number;
  position_in_team?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TeamPlayersService {
  // Reactive signals for state management
  teamPlayers = signal<TeamPlayer[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private supabaseService: SupabaseService) {}

  // Get all team-player assignments
  async getTeamPlayers(): Promise<{ data: TeamPlayer[] | null, error: any }> {
    this.loading.set(true);
    this.error.set(null);
    
    try {
      const { data, error } = await this.supabaseService.db
        .from('team_players')
        .select(`
          *,
          teams:team_id (
            id,
            name,
            short_name,
            primary_color
          ),
          players:player_id (
            id,
            name,
            position,
            category
          )
        `)
        .order('purchased_at', { ascending: false });

      if (error) {
        this.error.set(error.message);
        return { data: null, error };
      }

      this.teamPlayers.set(data || []);
      return { data: data as TeamPlayer[], error: null };
    } catch (error: any) {
      this.error.set(error.message);
      return { data: null, error };
    } finally {
      this.loading.set(false);
    }
  }

  // Get players for a specific team
  async getPlayersForTeam(teamId: string): Promise<{ data: TeamPlayer[] | null, error: any }> {
    try {
      const { data, error } = await this.supabaseService.db
        .from('team_players')
        .select(`
          *,
          players:player_id (
            id,
            name,
            position,
            category,
            nationality,
            base_price,
            image_url
          )
        `)
        .eq('team_id', teamId)
        .order('purchased_at', { ascending: false });

      if (error) {
        return { data: null, error };
      }

      return { data: data as TeamPlayer[], error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Assign player to team
  async assignPlayerToTeam(assignmentData: AssignPlayerToTeamData): Promise<{ data: TeamPlayer | null, error: any }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const { data, error } = await this.supabaseService.db
        .from('team_players')
        .insert([{
          team_id: assignmentData.team_id,
          player_id: assignmentData.player_id,
          purchase_price: assignmentData.purchase_price,
          position_in_team: assignmentData.position_in_team
        }])
        .select(`
          *,
          teams:team_id (
            id,
            name,
            short_name,
            primary_color
          ),
          players:player_id (
            id,
            name,
            position,
            category
          )
        `)
        .single();

      if (error) {
        this.error.set(error.message);
        return { data: null, error };
      }

      // Update local state
      this.teamPlayers.update(teamPlayers => [data as TeamPlayer, ...teamPlayers]);
      return { data: data as TeamPlayer, error: null };
    } catch (error: any) {
      this.error.set(error.message);
      return { data: null, error };
    } finally {
      this.loading.set(false);
    }
  }

  // Remove player from team
  async removePlayerFromTeam(teamPlayerId: string): Promise<{ error: any }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const { error } = await this.supabaseService.db
        .from('team_players')
        .delete()
        .eq('id', teamPlayerId);

      if (error) {
        this.error.set(error.message);
        return { error };
      }

      // Update local state
      this.teamPlayers.update(teamPlayers => 
        teamPlayers.filter(tp => tp.id !== teamPlayerId)
      );
      return { error: null };
    } catch (error: any) {
      this.error.set(error.message);
      return { error };
    } finally {
      this.loading.set(false);
    }
  }

  // Get sold players (players assigned to any team)
  async getSoldPlayers(): Promise<{ data: string[] | null, error: any }> {
    try {
      const { data, error } = await this.supabaseService.db
        .from('team_players')
        .select('player_id');

      if (error) {
        return { data: null, error };
      }

      const soldPlayerIds = (data || []).map(item => item.player_id);
      return { data: soldPlayerIds, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Clear error
  clearError(): void {
    this.error.set(null);
  }
} 