import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersService, UserWithRole } from '../../services/users.service';
import { SupabaseService, UserRole } from '../../services/supabase.service';

// Angular Material imports
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        MatFormFieldModule,
        MatInputModule,
        MatSnackBarModule,
        MatCardModule,
        MatProgressSpinnerModule,
        MatChipsModule,
        MatTooltipModule,
        MatMenuModule
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

    // Invite form state
    showInviteForm = signal(false);
    inviteEmail = signal('');
    inviteRole = signal<'admin' | 'user' | 'viewer'>('user');
    inviteLoading = signal(false);

    // Available roles for selection
    availableRoles: { value: 'admin' | 'user' | 'viewer'; label: string }[] = [
        { value: 'admin', label: 'Admin' },
        { value: 'user', label: 'User' },
        { value: 'viewer', label: 'Viewer' }
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

    // Statistics
    stats = computed(() => {
        const users = this.users();
        return {
            total: users.length,
            admins: users.filter(u => u.role === 'admin').length,
            regularUsers: users.filter(u => u.role === 'user').length,
            viewers: users.filter(u => u.role === 'viewer').length,
            banned: users.filter(u => u.is_banned).length,
            active: users.filter(u => !u.is_banned).length
        };
    });

    constructor(
        public usersService: UsersService,
        private supabaseService: SupabaseService,
        private snackBar: MatSnackBar
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
            this.snackBar.open('Please enter a valid email address', 'Close', {
                duration: 3000,
                panelClass: ['error-snackbar']
            });
            return;
        }

        this.inviteLoading.set(true);

        const { success, error } = await this.usersService.inviteUser({
            email,
            role: this.inviteRole()
        });

        if (success) {
            this.snackBar.open(`Invitation sent to ${email}`, 'Close', {
                duration: 3000,
                panelClass: ['success-snackbar']
            });
            this.closeInviteForm();
        } else {
            this.snackBar.open(`Error inviting user: ${error?.message || 'Unknown error'}`, 'Close', {
                duration: 5000,
                panelClass: ['error-snackbar']
            });
        }

        this.inviteLoading.set(false);
    }

    async onRoleChange(user: UserWithRole, newRole: 'admin' | 'user' | 'viewer') {
        // Prevent self-demotion from admin
        if (user.user_id === this.currentUserId() && user.role === 'admin' && newRole !== 'admin') {
            this.snackBar.open('You cannot remove your own admin privileges', 'Close', {
                duration: 5000,
                panelClass: ['error-snackbar']
            });
            return;
        }

        this.updatingUserId.set(user.user_id);

        const { success, error } = await this.usersService.updateUserRole(user.user_id, newRole);

        if (success) {
            this.snackBar.open(`Role updated to ${newRole} successfully`, 'Close', {
                duration: 3000,
                panelClass: ['success-snackbar']
            });
        } else {
            this.snackBar.open(`Error updating role: ${error?.message || 'Unknown error'}`, 'Close', {
                duration: 5000,
                panelClass: ['error-snackbar']
            });
        }

        this.updatingUserId.set(null);
    }

    async toggleUserBan(user: UserWithRole) {
        // Prevent self-ban
        if (user.user_id === this.currentUserId()) {
            this.snackBar.open('You cannot ban yourself', 'Close', {
                duration: 3000,
                panelClass: ['error-snackbar']
            });
            return;
        }

        const action = user.is_banned ? 'unban' : 'ban';
        if (!confirm(`Are you sure you want to ${action} ${user.email}?`)) {
            return;
        }

        this.updatingUserId.set(user.user_id);

        const { success, error } = await this.usersService.toggleUserBan(user.user_id, !user.is_banned);

        if (success) {
            this.snackBar.open(`User ${user.is_banned ? 'unbanned' : 'banned'} successfully`, 'Close', {
                duration: 3000,
                panelClass: ['success-snackbar']
            });
        } else {
            this.snackBar.open(`Error: ${error?.message || 'Unknown error'}`, 'Close', {
                duration: 5000,
                panelClass: ['error-snackbar']
            });
        }

        this.updatingUserId.set(null);
    }

    async deleteUser(user: UserWithRole) {
        // Prevent self-delete
        if (user.user_id === this.currentUserId()) {
            this.snackBar.open('You cannot delete your own account', 'Close', {
                duration: 3000,
                panelClass: ['error-snackbar']
            });
            return;
        }

        if (!confirm(`Are you sure you want to permanently delete ${user.email}? This action cannot be undone.`)) {
            return;
        }

        this.updatingUserId.set(user.user_id);

        const { success, error } = await this.usersService.deleteUser(user.user_id);

        if (success) {
            this.snackBar.open(`User deleted successfully`, 'Close', {
                duration: 3000,
                panelClass: ['success-snackbar']
            });
        } else {
            this.snackBar.open(`Error deleting user: ${error?.message || 'Unknown error'}`, 'Close', {
                duration: 5000,
                panelClass: ['error-snackbar']
            });
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

    getProviderIcon(provider: string): string {
        switch (provider) {
            case 'google':
                return 'g_translate';
            case 'github':
                return 'code';
            default:
                return 'email';
        }
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

