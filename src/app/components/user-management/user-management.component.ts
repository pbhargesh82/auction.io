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
            googleUsers: users.filter(u => u.provider === 'google').length,
            emailUsers: users.filter(u => u.provider === 'email').length
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
                return 'g_translate'; // Using a Material icon that resembles Google
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
