import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TeamsService, Team, CreateTeamData, UpdateTeamData } from '../../services/teams.service';
import { TeamWithPlayers } from '../team-card/team-card.component';
import { SupabaseService, UserRole } from '../../services/supabase.service';
import { ImageUploadService } from '../../services/image-upload.service';

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
import { AvatarComponent } from '../shared/avatar/avatar.component';

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
    AvatarComponent
  ],
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.css'],
  host: { class: 'block h-full w-full min-h-0' }
})
export class TeamsComponent implements OnInit {
  // Signals for reactive state management
  teams = signal<(Team | TeamWithPlayers)[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  showForm = signal(false);
  editingTeam = signal<Team | TeamWithPlayers | null>(null);
  searchTerm = signal('');
  userRole = signal<UserRole>('user');

  // Image upload signals
  logoPreview = signal<string | null>(null);
  uploadingLogo = signal(false);

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

  // Computed signal for admin status
  isAdmin = computed(() => this.userRole() === 'super_admin');


  // Table configuration
  displayedColumns: string[] = ['select', 'name', 'colors', 'budget', 'players', 'status', 'created', 'actions'];
  dataSource = computed(() => this.filteredTeams());

  constructor(
    private teamsService: TeamsService,
    private supabaseService: SupabaseService,
    private imageUploadService: ImageUploadService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
  ) {
    // Initialize form with enhanced fields
    this.teamForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      short_name: ['', [Validators.maxLength(5)]],
      logo_url: [''],
      primary_color: ['#1976d2'],
      secondary_color: ['#424242'],
      budget_cap: [100000, [Validators.required, Validators.min(100000)]],
      max_players: [25, [Validators.required, Validators.min(8), Validators.max(50)]],
      owner_name: ['']
    });

    // Use service signals directly
    this.teams = this.teamsService.teams;
    this.loading = this.teamsService.loading;
    this.error = this.teamsService.error;

    // Subscribe to user role changes
    this.supabaseService.userRole.subscribe(role => {
      this.userRole.set(role);
    });

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
    const { error } = await this.teamsService.getTeams(this.auctionId());
    if (error) {
      console.error('Error loading teams:', error);
    }
  }

  // Resolve the auction :id from the route param tree
  private auctionId(): string {
    let r: ActivatedRoute | null = this.route;
    while (r) {
      const id = r.snapshot.paramMap.get('id');
      if (id) return id;
      r = r.parent;
    }
    return '';
  }

  // Form operations
  openCreateForm() {
    this.editingTeam.set(null);
    this.logoPreview.set(null);
    this.teamForm.reset();
    this.teamForm.patchValue({
      name: '',
      short_name: '',
      logo_url: '',
      primary_color: '#1976d2',
      secondary_color: '#424242',
      budget_cap: 100000,
      max_players: 25,
      owner_name: ''
    });
    this.teamForm.markAsUntouched();
    this.teamForm.updateValueAndValidity();
    this.formValid.set(this.teamForm.valid);
    this.showForm.set(true);
  }

  openEditForm(team: Team | TeamWithPlayers) {
    this.editingTeam.set(team);
    this.logoPreview.set(team.logo_url || null);
    this.teamForm.patchValue({
      name: team.name,
      short_name: team.short_name || '',
      logo_url: team.logo_url || '',
      primary_color: team.primary_color,
      secondary_color: team.secondary_color,
      budget_cap: team.budget_cap,
      max_players: team.max_players,
      owner_name: (team as any).owner_name || ''
    });
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingTeam.set(null);
    this.logoPreview.set(null);
    this.teamForm.reset();
  }

  // Handle logo file selection
  async onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.uploadingLogo.set(true);

    try {
      // Compress image before upload
      const compressedFile = await this.imageUploadService.compressImage(file, 400, 0.8);

      // Upload to Supabase Storage
      const result = await this.imageUploadService.uploadImage(compressedFile, 'teams');

      if (result.success && result.url) {
        this.logoPreview.set(result.url);
        this.teamForm.patchValue({ logo_url: result.url });
        this.snackBar.open('Logo uploaded successfully', 'Close', { duration: 3000 });
      } else {
        this.snackBar.open(`Upload failed: ${result.error}`, 'Close', { duration: 5000 });
      }
    } catch (err: any) {
      this.snackBar.open(`Upload error: ${err.message}`, 'Close', { duration: 5000 });
    } finally {
      this.uploadingLogo.set(false);
    }
  }

  // Remove logo
  removeLogo() {
    this.logoPreview.set(null);
    this.teamForm.patchValue({ logo_url: '' });
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
        this.toast.set({ message: 'Team updated successfully!', type: 'success' });
      } else {
        // Create new team — pass explicit auctionId from route
        const { error } = await this.teamsService.createTeam(formData as CreateTeamData, this.auctionId());
        if (error) {
          this.toast.set({ message: `Error creating team: ${error.message}`, type: 'error' });
          return;
        }
        this.toast.set({ message: 'Team created successfully!', type: 'success' });
      }

      setTimeout(() => this.toast.set(null), 3000);
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
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
  }

  // Clear all filters
  clearFilters() {
    this.searchTerm.set('');
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
