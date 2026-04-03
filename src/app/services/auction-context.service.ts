import { Injectable, signal, computed } from '@angular/core';
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

const STORAGE_KEY = 'auction_current_auction_id';

@Injectable({
    providedIn: 'root'
})
export class AuctionContextService {
    // The currently selected auction
    private _currentAuctionId = signal<string | null>(this.loadFromStorage());
    private _currentAuction = signal<Auction | null>(null);
    private _userAuctions = signal<Auction[]>([]);
    private _loading = signal(false);

    // Public signals
    currentAuctionId = this._currentAuctionId.asReadonly();
    currentAuction = this._currentAuction.asReadonly();
    userAuctions = this._userAuctions.asReadonly();
    loading = this._loading.asReadonly();

    // Computed: whether an auction is selected
    hasAuction = computed(() => this._currentAuctionId() !== null);

    constructor(private supabaseService: SupabaseService) {
        // Check if user is already authenticated and load auctions
        if (this.supabaseService.currentUserValue) {
            this.loadUserAuctions();
        }
    }

    /**
     * Initialize the context - call this after user logs in
     */
    async initialize(): Promise<void> {
        if (this.supabaseService.currentUserValue) {
            await this.loadUserAuctions();
        }
    }

    /**
     * Load all auctions owned by the current user
     */
    async loadUserAuctions(): Promise<void> {
        this._loading.set(true);

        try {
            const { data, error } = await this.supabaseService.db
                .from('auctions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading auctions:', error);
                return;
            }

            this._userAuctions.set(data || []);

            // If we have a stored auction ID, load that auction's details
            const storedId = this._currentAuctionId();
            if (storedId) {
                const auction = data?.find(a => a.id === storedId);
                if (auction) {
                    this._currentAuction.set(auction);
                } else {
                    // Stored auction no longer exists, clear it
                    this.clearContext();
                }
            } else if (data && data.length > 0) {
                // Auto-select first auction if none selected
                this.selectAuction(data[0].id);
            }
        } finally {
            this._loading.set(false);
        }
    }

    /**
     * Select an auction as the current context
     */
    selectAuction(auctionId: string): void {
        this._currentAuctionId.set(auctionId);
        this.saveToStorage(auctionId);

        // Find and set the full auction object
        const auction = this._userAuctions().find(a => a.id === auctionId);
        if (auction) {
            this._currentAuction.set(auction);
        } else {
            // Need to fetch it
            this.fetchAuction(auctionId);
        }
    }

    /**
     * Fetch a single auction by ID
     */
    private async fetchAuction(auctionId: string): Promise<void> {
        const { data, error } = await this.supabaseService.db
            .from('auctions')
            .select('*')
            .eq('id', auctionId)
            .single();

        if (!error && data) {
            this._currentAuction.set(data);
        }
    }

    /**
     * Create a new auction
     */
    async createAuction(auction: Partial<Auction>): Promise<{ data: Auction | null; error: Error | null }> {
        const user = this.supabaseService.currentUserValue;
        if (!user) {
            return { data: null, error: new Error('Not authenticated') };
        }

        const { data, error } = await this.supabaseService.db
            .from('auctions')
            .insert({
                owner_id: user.id,
                name: auction.name,
                description: auction.description,
                budget_per_team: auction.budget_per_team || 10000000,
                max_players_per_team: auction.max_players_per_team || 25,
                min_players_per_team: auction.min_players_per_team || 15,
                status: 'draft',
                is_public: auction.is_public ?? true
            })
            .select()
            .single();

        if (!error && data) {
            // Refresh auctions list and select the new one
            await this.loadUserAuctions();
            this.selectAuction(data.id);
        }

        return { data, error: error as unknown as Error };
    }

    /**
     * Update an auction
     */
    async updateAuction(auctionId: string, updates: Partial<Auction>): Promise<{ error: Error | null }> {
        const { error } = await this.supabaseService.db
            .from('auctions')
            .update({
                name: updates.name,
                description: updates.description,
                budget_per_team: updates.budget_per_team,
                max_players_per_team: updates.max_players_per_team,
                min_players_per_team: updates.min_players_per_team,
                status: updates.status,
                is_public: updates.is_public
            })
            .eq('id', auctionId);

        if (!error) {
            await this.loadUserAuctions();
        }

        return { error: error as unknown as Error };
    }

    /**
     * Delete an auction
     */
    async deleteAuction(auctionId: string): Promise<{ error: Error | null }> {
        const { error } = await this.supabaseService.db
            .from('auctions')
            .delete()
            .eq('id', auctionId);

        if (!error) {
            // Clear context if we deleted the current auction
            if (this._currentAuctionId() === auctionId) {
                this.clearContext();
            }
            await this.loadUserAuctions();
        }

        return { error: error as unknown as Error };
    }

    /**
     * Get public auction by slug (no auth required)
     */
    async getPublicAuction(slug: string): Promise<{ data: Auction | null; error: Error | null }> {
        const { data, error } = await this.supabaseService.db
            .from('auctions')
            .select('*')
            .eq('public_slug', slug)
            .eq('is_public', true)
            .single();

        return { data, error: error as unknown as Error };
    }

    /**
     * Clear the current auction context
     */
    clearContext(): void {
        this._currentAuctionId.set(null);
        this._currentAuction.set(null);
        localStorage.removeItem(STORAGE_KEY);
    }

    /**
     * Load auction ID from localStorage
     */
    private loadFromStorage(): string | null {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(STORAGE_KEY);
        }
        return null;
    }

    /**
     * Save auction ID to localStorage
     */
    private saveToStorage(auctionId: string): void {
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, auctionId);
        }
    }
}
