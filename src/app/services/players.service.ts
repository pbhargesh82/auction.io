import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

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
  stats?: any; // JSONB field
  is_sold: boolean;
  is_active: boolean;
  auction_status?: 'PENDING' | 'CURRENT' | 'SOLD' | 'UNSOLD' | 'SKIPPED' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export interface CreatePlayerData {
  name: string;
  position: string;
  category: string;
  subcategory?: string;
  base_price?: number;
  image_url?: string;
  nationality?: string;
  age?: number;
  experience_years?: number;
  stats?: any;
}

export interface UpdatePlayerData extends Partial<CreatePlayerData> {
  is_sold?: boolean;
  is_active?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PlayersService {
  // Reactive signals for state management
  players = signal<Player[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private supabaseService: SupabaseService) {}

  // Get all players
  async getPlayers(): Promise<{ data: Player[] | null, error: any }> {
    this.loading.set(true);
    this.error.set(null);
    
    try {
      const { data, error } = await this.supabaseService.db
        .from('players')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        this.error.set(error.message);
        return { data: null, error };
      }

      this.players.set(data || []);
      return { data: data as Player[], error: null };
    } catch (error: any) {
      this.error.set(error.message);
      return { data: null, error };
    } finally {
      this.loading.set(false);
    }
  }

  // Get player by ID
  async getPlayerById(id: string): Promise<{ data: Player | null, error: any }> {
    try {
      const { data, error } = await this.supabaseService.db
        .from('players')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        return { data: null, error };
      }

      return { data: data as Player, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Create new player
  async createPlayer(playerData: CreatePlayerData): Promise<{ data: Player | null, error: any }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const { data, error } = await this.supabaseService.db
        .from('players')
        .insert([{
          name: playerData.name,
          position: playerData.position,
          category: playerData.category,
          subcategory: playerData.subcategory,
          base_price: playerData.base_price || 100000,
          image_url: playerData.image_url,
          nationality: playerData.nationality,
          age: playerData.age,
          experience_years: playerData.experience_years,
          stats: playerData.stats
        }])
        .select()
        .single();

      if (error) {
        this.error.set(error.message);
        return { data: null, error };
      }

      // Update local state
      this.players.update(players => [data as Player, ...players]);
      return { data: data as Player, error: null };
    } catch (error: any) {
      this.error.set(error.message);
      return { data: null, error };
    } finally {
      this.loading.set(false);
    }
  }

  // Update player
  async updatePlayer(id: string, playerData: UpdatePlayerData): Promise<{ data: Player | null, error: any }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const { data, error } = await this.supabaseService.db
        .from('players')
        .update({
          ...playerData,
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
      this.players.update(players => 
        players.map(player => player.id === id ? data as Player : player)
      );
      return { data: data as Player, error: null };
    } catch (error: any) {
      this.error.set(error.message);
      return { data: null, error };
    } finally {
      this.loading.set(false);
    }
  }

  // Delete player
  async deletePlayer(id: string): Promise<{ error: any }> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const { error } = await this.supabaseService.db
        .from('players')
        .delete()
        .eq('id', id);

      if (error) {
        this.error.set(error.message);
        return { error };
      }

      // Update local state
      this.players.update(players => players.filter(player => player.id !== id));
      return { error: null };
    } catch (error: any) {
      this.error.set(error.message);
      return { error };
    } finally {
      this.loading.set(false);
    }
  }

  // Toggle player active status
  async togglePlayerStatus(id: string): Promise<{ data: Player | null, error: any }> {
    const player = this.players().find(p => p.id === id);
    if (!player) {
      return { data: null, error: { message: 'Player not found' } };
    }

    return this.updatePlayer(id, { is_active: !player.is_active });
  }

  // Get player statistics
  async getPlayerStats(): Promise<{ data: any | null, error: any }> {
    try {
      const { data, error } = await this.supabaseService.db
        .from('players')
        .select('category, position, is_sold, is_active')
        .order('created_at', { ascending: false });

      if (error) {
        return { data: null, error };
      }

      const stats = {
        total: data.length,
        active: data.filter(p => p.is_active).length,
        sold: data.filter(p => p.is_sold).length,
        unsold: data.filter(p => !p.is_sold).length,
        byCategory: data.reduce((acc: any, player: any) => {
          acc[player.category] = (acc[player.category] || 0) + 1;
          return acc;
        }, {}),
        byPosition: data.reduce((acc: any, player: any) => {
          acc[player.position] = (acc[player.position] || 0) + 1;
          return acc;
        }, {})
      };

      return { data: stats, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Clear error state
  clearError(): void {
    this.error.set(null);
  }

  // Get players by category
  async getPlayersByCategory(category: string): Promise<{ data: Player[] | null, error: any }> {
    try {
      const { data, error } = await this.supabaseService.db
        .from('players')
        .select('*')
        .eq('category', category)
        .order('name', { ascending: true });

      if (error) {
        return { data: null, error };
      }

      return { data: data as Player[], error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Get unsold players
  async getUnsoldPlayers(): Promise<{ data: Player[] | null, error: any }> {
    try {
      const { data, error } = await this.supabaseService.db
        .from('players')
        .select('*')
        .eq('is_sold', false)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        return { data: null, error };
      }

      return { data: data as Player[], error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }
} 