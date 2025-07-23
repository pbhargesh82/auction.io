import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Event {
  id: string;
  name: string;
  description?: string;
  event_type: 'auction' | 'draft' | 'trade' | 'other';
  start_date: string;
  end_date: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface CreateEventData {
  name: string;
  description?: string;
  event_type: 'auction' | 'draft' | 'trade' | 'other';
  start_date: string;
  end_date: string;
}

export interface UpdateEventData {
  name?: string;
  description?: string;
  event_type?: 'auction' | 'draft' | 'trade' | 'other';
  start_date?: string;
  end_date?: string;
  status?: 'scheduled' | 'active' | 'completed' | 'cancelled';
}

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private eventsSubject = new BehaviorSubject<Event[]>([]);
  private currentEventSubject = new BehaviorSubject<Event | null>(null);

  public events$ = this.eventsSubject.asObservable();
  public currentEvent$ = this.currentEventSubject.asObservable();

  constructor(private supabase: SupabaseService) {}

  // Get all events
  async getEvents(): Promise<{ data: Event[] | null, error: any }> {
    try {
      const { data, error } = await this.supabase.db
        .from('events')
        .select('*')
        .order('start_date', { ascending: true });

      if (error) throw error;
      
      this.eventsSubject.next(data || []);
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching events:', error);
      return { data: null, error };
    }
  }

  // Get event by ID
  async getEventById(id: string): Promise<{ data: Event | null, error: any }> {
    try {
      const { data, error } = await this.supabase.db
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      this.currentEventSubject.next(data);
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching event:', error);
      return { data: null, error };
    }
  }

  // Create new event
  async createEvent(eventData: CreateEventData): Promise<{ data: Event | null, error: any }> {
    try {
      const { data, error } = await this.supabase.db
        .from('events')
        .insert([eventData])
        .select()
        .single();

      if (error) throw error;
      
      // Refresh events list
      await this.getEvents();
      return { data, error: null };
    } catch (error) {
      console.error('Error creating event:', error);
      return { data: null, error };
    }
  }

  // Update event
  async updateEvent(id: string, updateData: UpdateEventData): Promise<{ data: Event | null, error: any }> {
    try {
      const { data, error } = await this.supabase.db
        .from('events')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Refresh events list and current event
      await this.getEvents();
      if (this.currentEventSubject.value?.id === id) {
        this.currentEventSubject.next(data);
      }
      return { data, error: null };
    } catch (error) {
      console.error('Error updating event:', error);
      return { data: null, error };
    }
  }

  // Delete event
  async deleteEvent(id: string): Promise<{ error: any }> {
    try {
      const { error } = await this.supabase.db
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Refresh events list
      await this.getEvents();
      return { error: null };
    } catch (error) {
      console.error('Error deleting event:', error);
      return { error };
    }
  }

  // Get events by type
  async getEventsByType(eventType: Event['event_type']): Promise<{ data: Event[] | null, error: any }> {
    try {
      const { data, error } = await this.supabase.db
        .from('events')
        .select('*')
        .eq('event_type', eventType)
        .order('start_date', { ascending: true });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching events by type:', error);
      return { data: null, error };
    }
  }

  // Get active events
  async getActiveEvents(): Promise<{ data: Event[] | null, error: any }> {
    try {
      const { data, error } = await this.supabase.db
        .from('events')
        .select('*')
        .eq('status', 'active')
        .order('start_date', { ascending: true });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching active events:', error);
      return { data: null, error };
    }
  }

  // Subscribe to event updates
  subscribeToEventUpdates() {
    return this.supabase.db
      .channel('event-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          console.log('Event change received:', payload);
          // Refresh events list when changes occur
          this.getEvents();
        }
      )
      .subscribe();
  }

  // Utility methods
  async getUpcomingEvents(limit: number = 5): Promise<{ data: Event[] | null, error: any }> {
    try {
      const now = new Date().toISOString();
      const { data, error } = await this.supabase.db
        .from('events')
        .select('*')
        .gte('start_date', now)
        .order('start_date', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
      return { data: null, error };
    }
  }

  // Set current event
  setCurrentEvent(event: Event | null) {
    this.currentEventSubject.next(event);
  }

  // Clear current event
  clearCurrentEvent() {
    this.currentEventSubject.next(null);
  }
} 