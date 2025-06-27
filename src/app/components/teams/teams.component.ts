import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TeamsService, Team, CreateTeamData, UpdateTeamData } from '../../services/teams.service';

// Angular Material imports
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatSnackBarModule,
    MatCheckboxModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule
  ],
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.css']
})
export class TeamsComponent implements OnInit {
  // Signals for reactive state management
  teams = signal<Team[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  showForm = signal(false);
  editingTeam = signal<Team | null>(null);
  selectedTeams = signal<Set<string>>(new Set());
  searchTerm = signal('');
  sortField = signal<keyof Team>('name');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Form
  teamForm: FormGroup;
  formSubmitting = signal(false);

  // Computed values
  filteredTeams = computed(() => {
    const teams = this.teams();
    const search = this.searchTerm().toLowerCase();
    const field = this.sortField();
    const direction = this.sortDirection();

    // Filter by search term
    let filtered = teams.filter(team => 
      team.name.toLowerCase().includes(search) ||
      (team.short_name?.toLowerCase().includes(search)) ||
      team.primary_color.toLowerCase().includes(search)
    );

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const result = aVal.localeCompare(bVal);
        return direction === 'asc' ? result : -result;
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        const result = aVal - bVal;
        return direction === 'asc' ? result : -result;
      }
      
      return 0;
    });

    return filtered;
  });

  selectedCount = computed(() => this.selectedTeams().size);
  isAllSelected = computed(() => 
    this.filteredTeams().length > 0 && 
    this.selectedTeams().size === this.filteredTeams().length
  );
  isFormValid = computed(() => this.teamForm?.valid || false);

  // Statistics computed properties
  activeTeamsCount = computed(() => this.teams().filter(t => t.is_active).length);
  totalPlayersCount = computed(() => this.teams().reduce((sum, t) => sum + t.players_count, 0));
  totalBudget = computed(() => this.teams().reduce((sum, t) => sum + t.budget_cap, 0));

  // Table configuration
  displayedColumns: string[] = ['select', 'name', 'colors', 'budget', 'players', 'status', 'created', 'actions'];
  dataSource = computed(() => this.filteredTeams());

  constructor(
    private teamsService: TeamsService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    // Initialize form
    this.teamForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      short_name: ['', [Validators.maxLength(10)]],
      logo_url: [''],
      primary_color: ['#1976d2', [Validators.required]],
      secondary_color: ['#424242', [Validators.required]],
      budget_cap: [10000000, [Validators.required, Validators.min(1000000)]],
      max_players: [25, [Validators.required, Validators.min(15), Validators.max(50)]]
    });

    // Use service signals directly
    this.teams = this.teamsService.teams;
    this.loading = this.teamsService.loading;
    this.error = this.teamsService.error;
  }

  async ngOnInit() {
    await this.loadTeams();
  }

  // Data operations
  async loadTeams() {
    const { error } = await this.teamsService.getTeams();
    if (error) {
      console.error('Error loading teams:', error);
    }
  }

  // Form operations
  openCreateForm() {
    this.editingTeam.set(null);
    this.teamForm.reset({
      name: '',
      short_name: '',
      logo_url: '',
      primary_color: '#1976d2',
      secondary_color: '#424242',
      budget_cap: 10000000,
      max_players: 25
    });
    this.showForm.set(true);
  }

  openEditForm(team: Team) {
    this.editingTeam.set(team);
    this.teamForm.patchValue({
      name: team.name,
      short_name: team.short_name || '',
      logo_url: team.logo_url || '',
      primary_color: team.primary_color,
      secondary_color: team.secondary_color,
      budget_cap: team.budget_cap,
      max_players: team.max_players
    });
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingTeam.set(null);
    this.teamForm.reset();
  }

  async onSubmit() {
    if (!this.isFormValid()) return;

    this.formSubmitting.set(true);
    const formData = this.teamForm.value;
    const editingTeam = this.editingTeam();

    try {
      if (editingTeam) {
        // Update existing team
        const { error } = await this.teamsService.updateTeam(editingTeam.id, formData as UpdateTeamData);
        if (error) {
          this.snackBar.open(`Error updating team: ${error.message}`, 'Close', { 
            duration: 5000, 
            panelClass: ['error-snackbar'] 
          });
          return;
        }
        this.snackBar.open('Team updated successfully!', 'Close', { 
          duration: 3000, 
          panelClass: ['success-snackbar'] 
        });
      } else {
        // Create new team
        const { error } = await this.teamsService.createTeam(formData as CreateTeamData);
        if (error) {
          this.snackBar.open(`Error creating team: ${error.message}`, 'Close', { 
            duration: 5000, 
            panelClass: ['error-snackbar'] 
          });
          return;
        }
        this.snackBar.open('Team created successfully!', 'Close', { 
          duration: 3000, 
          panelClass: ['success-snackbar'] 
        });
      }
      
      this.closeForm();
    } catch (error: any) {
      this.snackBar.open(`Error: ${error.message}`, 'Close', { 
        duration: 5000, 
        panelClass: ['error-snackbar'] 
      });
    } finally {
      this.formSubmitting.set(false);
    }
  }

  // Table operations
  async deleteTeam(team: Team) {
    if (!confirm(`Are you sure you want to delete "${team.name}"? This action cannot be undone.`)) {
      return;
    }

    const { error } = await this.teamsService.deleteTeam(team.id);
    if (error) {
      this.snackBar.open(`Error deleting team: ${error.message}`, 'Close', { 
        duration: 5000, 
        panelClass: ['error-snackbar'] 
      });
    } else {
      this.snackBar.open('Team deleted successfully!', 'Close', { 
        duration: 3000, 
        panelClass: ['success-snackbar'] 
      });
    }
  }

  async toggleTeamStatus(team: Team) {
    const { error } = await this.teamsService.toggleTeamStatus(team.id);
    if (error) {
      this.snackBar.open(`Error updating team status: ${error.message}`, 'Close', { 
        duration: 5000, 
        panelClass: ['error-snackbar'] 
      });
    } else {
      this.snackBar.open(`Team ${team.is_active ? 'deactivated' : 'activated'} successfully!`, 'Close', { 
        duration: 3000, 
        panelClass: ['success-snackbar'] 
      });
    }
  }

  // Selection operations
  toggleSelectAll() {
    const selected = this.selectedTeams();
    if (this.isAllSelected()) {
      this.selectedTeams.set(new Set());
    } else {
      const allIds = new Set(this.filteredTeams().map(team => team.id));
      this.selectedTeams.set(allIds);
    }
  }

  toggleSelectTeam(teamId: string) {
    const selected = new Set(this.selectedTeams());
    if (selected.has(teamId)) {
      selected.delete(teamId);
    } else {
      selected.add(teamId);
    }
    this.selectedTeams.set(selected);
  }

  async deleteSelectedTeams() {
    const selectedIds = Array.from(this.selectedTeams());
    if (selectedIds.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected teams? This action cannot be undone.`)) {
      return;
    }

    this.loading.set(true);
    let errorCount = 0;

    for (const teamId of selectedIds) {
      const { error } = await this.teamsService.deleteTeam(teamId);
      if (error) {
        errorCount++;
      }
    }

    this.loading.set(false);
    this.selectedTeams.set(new Set());

    if (errorCount === 0) {
      this.snackBar.open(`Successfully deleted ${selectedIds.length} teams.`, 'Close', { 
        duration: 3000, 
        panelClass: ['success-snackbar'] 
      });
    } else {
      this.snackBar.open(`Deleted ${selectedIds.length - errorCount} teams. ${errorCount} teams could not be deleted.`, 'Close', { 
        duration: 5000, 
        panelClass: ['warning-snackbar'] 
      });
    }
  }

  // Sorting
  sort(field: keyof Team) {
    if (this.sortField() === field) {
      this.sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  // Search
  onSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  // Utility methods
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getBudgetPercentage(team: Team): number {
    return (team.budget_spent / team.budget_cap) * 100;
  }

  getStatusColor(isActive: boolean): string {
    return isActive ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100';
  }

  clearError() {
    this.error.set(null);
    this.teamsService.clearError();
  }
}
