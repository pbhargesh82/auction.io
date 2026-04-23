import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersService, UserWithRole } from '../../services/users.service';
import { SupabaseService, UserRole } from '../../services/supabase.service';
import { SidePanelComponent } from '../shared/side-panel/side-panel.component';

import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        SidePanelComponent,
        MatIconModule
    ],
    templateUrl: './user-management.component.html',
    styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
    // Signals for reactive state management
    users = signal<UserWithRole[]>([]);
    loading = signal(false);
    error = signal<string | null>(null);
    searchTerm = signal('');
    updatingUserId = signal<string | null>(null);
    currentUserId = signal<string | null>(null);

    // Toast UI state
    toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);

    // Invite form state
    showInviteForm = signal(false);
    inviteEmail = signal('');
    inviteRole = signal<'super_admin' | 'user'>('user');
    inviteLoading = signal(false);

    // Available roles for selection
    availableRoles: { value: 'super_admin' | 'user'; label: string }[] = [
        { value: 'super_admin', label: 'Super Admin' },
        { value: 'user', label: 'User' }
    ];

    // Computed values
    filteredUsers = computed(() => {
        const users = this.users();
        const search = this.searchTerm().toLowerCase();

        if (!search) return users;

        return users.filter(user =>
            user.email.toLowerCase().includes(search) ||
            user.role.toLowerCase().includes(search) ||
            user.provider.toLowerCase().includes(search)
        );
    });

    constructor(
        public usersService: UsersService,
        private supabaseService: SupabaseService
    ) {
        // Use service signals directly
        this.users = this.usersService.users;
        this.loading = this.usersService.loading;
        this.error = this.usersService.error;
    }

    async ngOnInit() {
        // Get current user ID to prevent self-demotion
        const currentUser = this.supabaseService.currentUserValue;
        if (currentUser) {
            this.currentUserId.set(currentUser.id);
        }

        await this.loadUsers();
    }

    async loadUsers() {
        const { error } = await this.usersService.getUsers();
        if (error) {
            console.error('Error loading users:', error);
            this.notify('Failed to load users', 'error');
        }
    }

    // Helper to show notifications
    private notify(message: string, type: 'success' | 'error' = 'success') {
        this.toast.set({ message, type });
        setTimeout(() => {
            if (this.toast()?.message === message) {
                this.toast.set(null);
            }
        }, 3000);
    }

    // Invite form methods
    openInviteForm() {
        this.showInviteForm.set(true);
        this.inviteEmail.set('');
        this.inviteRole.set('user');
    }

    closeInviteForm() {
        this.showInviteForm.set(false);
        this.inviteEmail.set('');
    }

    async submitInvite() {
        const email = this.inviteEmail().trim();
        if (!email || !email.includes('@')) {
            this.notify('Please enter a valid email address', 'error');
            return;
        }

        this.inviteLoading.set(true);

        const { success, error } = await this.usersService.inviteUser({
            email,
            role: this.inviteRole()
        });

        if (success) {
            this.notify(`Invitation sent to ${email}`, 'success');
            this.closeInviteForm();
        } else {
            this.notify(`Error inviting user: ${error?.message || 'Unknown error'}`, 'error');
        }

        this.inviteLoading.set(false);
    }

    async onRoleChange(user: UserWithRole, newRole: any) {
        // Prevent self-demotion from super_admin
        if (user.user_id === this.currentUserId() && user.role === 'super_admin' && newRole !== 'super_admin') {
            this.notify('You cannot remove your own admin privileges', 'error');
            return;
        }

        this.updatingUserId.set(user.user_id);

        const { success, error } = await this.usersService.updateUserRole(user.user_id, newRole);

        if (success) {
            this.notify(`Role updated to ${newRole} successfully`, 'success');
        } else {
            this.notify(`Error updating role: ${error?.message || 'Unknown error'}`, 'error');
        }

        this.updatingUserId.set(null);
    }

    async toggleUserBan(user: UserWithRole) {
        // Prevent self-ban
        if (user.user_id === this.currentUserId()) {
            this.notify('You cannot ban yourself', 'error');
            return;
        }

        const action = user.is_banned ? 'unban' : 'ban';
        if (!confirm(`Are you sure you want to ${action} ${user.email}?`)) {
            return;
        }

        this.updatingUserId.set(user.user_id);

        const { success, error } = await this.usersService.toggleUserBan(user.user_id, !user.is_banned);

        if (success) {
            this.notify(`User ${user.is_banned ? 'unbanned' : 'banned'} successfully`, 'success');
        } else {
            this.notify(`Error: ${error?.message || 'Unknown error'}`, 'error');
        }

        this.updatingUserId.set(null);
    }

    async deleteUser(user: UserWithRole) {
        // Prevent self-delete
        if (user.user_id === this.currentUserId()) {
            this.notify('You cannot delete your own account', 'error');
            return;
        }

        if (!confirm(`Are you sure you want to permanently delete ${user.email}? This action cannot be undone.`)) {
            return;
        }

        this.updatingUserId.set(user.user_id);

        const { success, error } = await this.usersService.deleteUser(user.user_id);

        if (success) {
            this.notify(`User deleted successfully`, 'success');
        } else {
            this.notify(`Error deleting user: ${error?.message || 'Unknown error'}`, 'error');
        }

        this.updatingUserId.set(null);
    }

    onSearch(event: Event) {
        const input = event.target as HTMLInputElement;
        this.searchTerm.set(input.value);
    }

    clearError() {
        this.error.set(null);
    }

    getRoleConfig(role: string) {
        return this.usersService.getRoleConfig(role);
    }

    getProviderLabel(provider: string): string {
        return this.usersService.getProviderLabel(provider);
    }

    formatDate(dateString: string | null): string {
        return this.usersService.formatDate(dateString);
    }

    isCurrentUser(userId: string): boolean {
        return userId === this.currentUserId();
    }
}
