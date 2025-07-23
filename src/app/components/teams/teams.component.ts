import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TeamsService, Team, CreateTeamData, UpdateTeamData } from '../../services/teams.service';
import { TeamWithPlayers } from '../team-card/team-card.component';

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
import { TeamCardComponent } from '../team-card/team-card.component';

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
    MatTooltipModule,
    TeamCardComponent
  ],
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.css']
})
export class TeamsComponent implements OnInit {
  // Signals for reactive state management
  teams = signal<(Team | TeamWithPlayers)[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  showForm = signal(false);
  editingTeam = signal<Team | TeamWithPlayers | null>(null);
  searchTerm = signal('');

  // Form
  teamForm: FormGroup;
  formSubmitting = signal(false);
  formValid = signal(false);

  // Computed values
  filteredTeams = computed(() => {
    const teams = this.teams();
    const search = this.searchTerm().toLowerCase();

    // Filter by search term
    return teams.filter(team => 
      team.name.toLowerCase().includes(search) ||
      (team.short_name?.toLowerCase().includes(search))
    );
  });

  isFormValid = computed(() => this.formValid());



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
    
    // Subscribe to form changes to update validity signal
    this.teamForm.statusChanges.subscribe(() => {
      this.formValid.set(this.teamForm.valid);
    });
    
    this.teamForm.valueChanges.subscribe(() => {
      this.formValid.set(this.teamForm.valid);
    });
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
    this.teamForm.reset();
    this.teamForm.patchValue({
      name: '',
      short_name: '',
      logo_url: '',
      primary_color: '#1976d2',
      secondary_color: '#424242',
      budget_cap: 10000000,
      max_players: 25
    });
    this.teamForm.markAsUntouched();
    this.teamForm.updateValueAndValidity();
    this.formValid.set(this.teamForm.valid);
    this.showForm.set(true);
  }

  openEditForm(team: Team | TeamWithPlayers) {
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
  async deleteTeam(team: Team | TeamWithPlayers) {
    if (!confirm(`Are you sure you want to delete "${team.name}"? This action cannot be undone.`)) {
      return;
    }

    const { error } = await this.teamsService.deleteTeam(team.id);
    if (error) {
      this.snackBar.open(`Error deleting team: ${error.message}`, 'Close', { 
        duration: 5000, 
        panelClass: ['error-snackbar'] 
      });
    }
  }

  // View team details
  viewTeam(team: Team | TeamWithPlayers) {
    // In a real app, you might navigate to a detail view
    this.snackBar.open(`Viewing team: ${team.name}`, 'Close', {
      duration: 2000
    });
  }

  // Edit team - wrapper around openEditForm for template
  editTeam(team: Team | TeamWithPlayers) {
    this.openEditForm(team);
  }

  // Confirm delete - wrapper around deleteTeam for template
  confirmDelete(team: Team | TeamWithPlayers) {
    this.deleteTeam(team);
  }

  // Toggle team active status
  async toggleTeamStatus(team: Team | TeamWithPlayers) {
    const newStatus = !team.is_active;
    const { error } = await this.teamsService.updateTeam(team.id, { is_active: newStatus });
    
    if (error) {
      this.snackBar.open(`Error updating team status: ${error.message}`, 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
    } else {
      this.snackBar.open(`Team ${newStatus ? 'activated' : 'deactivated'} successfully`, 'Close', {
        duration: 2000
      });
    }
  }

  // Clear error message
  clearError() {
    this.error.set(null);
  }

  // Handle search input
  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  // Handle primary color input
  onPrimaryColorInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.teamForm.get('primary_color')?.setValue(input.value);
  }

  // Handle secondary color input
  onSecondaryColorInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.teamForm.get('secondary_color')?.setValue(input.value);
  }

  // Format currency for display
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // Format date for display
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Calculate budget percentage
  getBudgetPercentage(team: Team | TeamWithPlayers): number {
    if (!team.budget_spent || !team.budget_cap) return 0;
    return (team.budget_spent / team.budget_cap) * 100;
  }

  // Get status color class
  getStatusColor(isActive: boolean): string {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  }
}
