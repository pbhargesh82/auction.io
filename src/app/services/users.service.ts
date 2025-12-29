import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface AppUser {
    id: string;
    email: string;
    role: 'admin' | 'user' | 'viewer';
    created_at: string;
    last_sign_in_at: string | null;
    provider: string;
    email_confirmed_at: string | null;
    updated_at: string;
}

export interface UserWithRole {
    user_id: string;
    email: string;
    role: 'admin' | 'user' | 'viewer';
    created_at: string;
    last_sign_in_at: string | null;
    provider: string;
    email_confirmed: boolean;
    role_updated_at: string;
}

@Injectable({
    providedIn: 'root'
})
export class UsersService {
    // Signals for reactive state
    users = signal<UserWithRole[]>([]);
    loading = signal(false);
    error = signal<string | null>(null);

    constructor(private supabaseService: SupabaseService) { }

    /**
     * Fetch all users with their roles
     * Only accessible by admin users via RPC function or view
     */
    async getUsers(): Promise<{ data: UserWithRole[] | null; error: Error | null }> {
        this.loading.set(true);
        this.error.set(null);

        try {
            // Call the admin RPC function to get users with roles
            const { data, error } = await this.supabaseService.db
                .rpc('get_all_users_with_roles');

            if (error) {
                this.error.set(error.message);
                return { data: null, error: error as unknown as Error };
            }

            const usersWithRoles = (data || []) as UserWithRole[];
            this.users.set(usersWithRoles);
            return { data: usersWithRoles, error: null };
        } catch (err: any) {
            this.error.set(err.message);
            return { data: null, error: err };
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Update a user's role
     */
    async updateUserRole(
        userId: string,
        newRole: 'admin' | 'user' | 'viewer'
    ): Promise<{ success: boolean; error: Error | null }> {
        try {
            // Call the RPC function to update role
            const { data, error } = await this.supabaseService.db
                .rpc('admin_update_user_role', {
                    target_user_id: userId,
                    new_role: newRole
                });

            if (error) {
                return { success: false, error: error as unknown as Error };
            }

            // Refresh the users list
            await this.getUsers();
            return { success: true, error: null };
        } catch (err: any) {
            return { success: false, error: err };
        }
    }

    /**
     * Get role display properties
     */
    getRoleConfig(role: string): { label: string; color: string; bgColor: string } {
        switch (role) {
            case 'admin':
                return { label: 'Admin', color: 'text-purple-700', bgColor: 'bg-purple-100' };
            case 'viewer':
                return { label: 'Viewer', color: 'text-blue-700', bgColor: 'bg-blue-100' };
            default:
                return { label: 'User', color: 'text-gray-700', bgColor: 'bg-gray-100' };
        }
    }

    /**
     * Get provider display name
     */
    getProviderLabel(provider: string): string {
        switch (provider) {
            case 'google':
                return 'Google';
            case 'email':
                return 'Email/Password';
            case 'github':
                return 'GitHub';
            default:
                return provider || 'Unknown';
        }
    }

    /**
     * Format date for display
     */
    formatDate(dateString: string | null): string {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}
