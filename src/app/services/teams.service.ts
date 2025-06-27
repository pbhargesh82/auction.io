import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Team {
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
}

export interface CreateTeamData {
  name: string;
  short_name?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  budget_cap?: number;
  max_players?: number;
}

export interface UpdateTeamData extends Partial<CreateTeamData> {
  is_active?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TeamsService {
  // Reactive signals for state management
  teams = signal<Team[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private supabaseService: SupabaseService) {}

  // Get all teams
  async getTeams(): Promise<{ data: Team[] | null, error: any }> {
    this.loading.set(true);
    this.error.set(null);
    
    try {
      const { data, error } = await this.supabaseService.db
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        this.error.set(error.message);
        return { data: null, error };
      }

      this.teams.set(data || []);
      return { data: data as Team[], error: null };
    } catch (error: any) {
      this.error.set(error.message);
      return { data: null, error };
    } finally {
      this.loading.set(false);
    }
  }

  // Get team by ID
  async getTeamById(id: string): Promise<{ data: Team | null, error: any }> {
    try {
      const { data, error } = await this.supabaseService.db
        .from('teams')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return { data: null, error };
      }

      return { data: data as Team, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Create new team
  async createTeam(teamData: CreateTeamData): Promise<{ data: Team | null, error: any }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const { data, error } = await this.supabaseService.db
        .from('teams')
        .insert([{
          name: teamData.name,
          short_name: teamData.short_name,
          logo_url: teamData.logo_url,
          primary_color: teamData.primary_color || '#1976d2',
          secondary_color: teamData.secondary_color || '#424242',
          budget_cap: teamData.budget_cap || 10000000,
          max_players: teamData.max_players || 25
        }])
        .select()
        .single();

      if (error) {
        this.error.set(error.message);
        return { data: null, error };
      }

      // Update local state
      this.teams.update(teams => [data as Team, ...teams]);
      return { data: data as Team, error: null };
    } catch (error: any) {
      this.error.set(error.message);
      return { data: null, error };
    } finally {
      this.loading.set(false);
    }
  }

  // Update team
  async updateTeam(id: string, teamData: UpdateTeamData): Promise<{ data: Team | null, error: any }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const { data, error } = await this.supabaseService.db
        .from('teams')
        .update({
          ...teamData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.error.set(error.message);
        return { data: null, error };
      }

      // Update local state
      this.teams.update(teams => 
        teams.map(team => team.id === id ? data as Team : team)
      );
      return { data: data as Team, error: null };
    } catch (error: any) {
      this.error.set(error.message);
      return { data: null, error };
    } finally {
      this.loading.set(false);
    }
  }

  // Delete team
  async deleteTeam(id: string): Promise<{ error: any }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const { error } = await this.supabaseService.db
        .from('teams')
        .delete()
        .eq('id', id);

      if (error) {
        this.error.set(error.message);
        return { error };
      }

      // Update local state
      this.teams.update(teams => teams.filter(team => team.id !== id));
      return { error: null };
    } catch (error: any) {
      this.error.set(error.message);
      return { error };
    } finally {
      this.loading.set(false);
    }
  }

  // Toggle team active status
  async toggleTeamStatus(id: string): Promise<{ data: Team | null, error: any }> {
    const team = this.teams().find(t => t.id === id);
    if (!team) {
      return { data: null, error: { message: 'Team not found' } };
    }

    return this.updateTeam(id, { is_active: !team.is_active });
  }

  // Get team statistics
  async getTeamStats(): Promise<{ data: any | null, error: any }> {
    try {
      const { data, error } = await this.supabaseService.db
        .from('team_stats')
        .select('*');

      return { data, error };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Clear error
  clearError(): void {
    this.error.set(null);
  }
} 