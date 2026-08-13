import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersService, UserWithRole } from '../../services/users.service';
import { SupabaseService, UserRole } from '../../services/supabase.service';
import { SidePanelComponent } from '../shared/side-panel/side-panel.component';
import { AvatarComponent } from '../shared/avatar/avatar.component';
import { ToastService } from '../../services/toast.service';

import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        SidePanelComponent,
        AvatarComponent,
        MatIconModule
    ],
    templateUrl: './user-management.component.html',
    styleUrls: ['./user-management.component.css'],
    host: { class: 'block h-full w-full min-h-0' }
})
export class UserManagementComponent implements OnInit {
    // Signals for reactive state management
    users = signal<UserWithRole[]>([]);
    loading = signal(false);
    error = signal<string | null>(null);
    searchTerm = signal('');
    updatingUserId = signal<string | null>(null);
    currentUserId = signal<string | null>(null);

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
        private supabaseService: SupabaseService,
        private toast: ToastService
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
            this.toast.error('Failed to load users');
        }
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
            this.toast.error('Please enter a valid email address');
            return;
        }

        this.inviteLoading.set(true);

        const { success, error } = await this.usersService.inviteUser({
            email,
            role: this.inviteRole()
        });

        if (success) {
            this.toast.success(`Invitation sent to ${email}`);
            this.closeInviteForm();
        } else {
            this.toast.error(`Error inviting user: ${error?.message || 'Unknown error'}`);
        }

        this.inviteLoading.set(false);
    }

    async onRoleChange(user: UserWithRole, newRole: any) {
        // Prevent self-demotion from super_admin
        if (user.user_id === this.currentUserId() && user.role === 'super_admin' && newRole !== 'super_admin') {
            this.toast.error('You cannot remove your own admin privileges');
            return;
        }

        this.updatingUserId.set(user.user_id);

        const { success, error } = await this.usersService.updateUserRole(user.user_id, newRole);

        if (success) {
            this.toast.success(`Role updated to ${newRole} successfully`);
        } else {
            this.toast.error(`Error updating role: ${error?.message || 'Unknown error'}`);
        }

        this.updatingUserId.set(null);
    }

    async toggleUserBan(user: UserWithRole) {
        // Prevent self-ban
        if (user.user_id === this.currentUserId()) {
            this.toast.error('You cannot ban yourself');
            return;
        }

        const action = user.is_banned ? 'unban' : 'ban';
        if (!confirm(`Are you sure you want to ${action} ${user.email}?`)) {
            return;
        }

        this.updatingUserId.set(user.user_id);

        const { success, error } = await this.usersService.toggleUserBan(user.user_id, !user.is_banned);

        if (success) {
            this.toast.success(`User ${user.is_banned ? 'unbanned' : 'banned'} successfully`);
        } else {
            this.toast.error(`Error: ${error?.message || 'Unknown error'}`);
        }

        this.updatingUserId.set(null);
    }

    async deleteUser(user: UserWithRole) {
        // Prevent self-delete
        if (user.user_id === this.currentUserId()) {
            this.toast.error('You cannot delete your own account');
            return;
        }

        if (!confirm(`Are you sure you want to permanently delete ${user.email}? This action cannot be undone.`)) {
            return;
        }

        this.updatingUserId.set(user.user_id);

        const { success, error } = await this.usersService.deleteUser(user.user_id);

        if (success) {
            this.toast.success(`User deleted successfully`);
        } else {
            this.toast.error(`Error deleting user: ${error?.message || 'Unknown error'}`);
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
