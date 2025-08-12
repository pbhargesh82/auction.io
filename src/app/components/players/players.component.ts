import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PlayersService, Player, CreatePlayerData, UpdatePlayerData } from '../../services/players.service';
import { TeamPlayersService } from '../../services/team-players.service';
import { SupabaseService, UserRole } from '../../services/supabase.service';

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
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-players',
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
    MatSelectModule
  ],
  templateUrl: './players.component.html',
  styleUrls: ['./players.component.css']
})
export class PlayersComponent implements OnInit {
  // Signals for reactive state management
  players = signal<Player[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  showForm = signal(false);
  editingPlayer = signal<Player | null>(null);
  selectedPlayers = signal<Set<string>>(new Set());
  searchTerm = signal('');
  sortField = signal<keyof Player>('name');
  sortDirection = signal<'asc' | 'desc'>('asc');
  filterCategory = signal<string>('');
  filterPosition = signal<string>('');
  soldPlayerIds = signal<string[]>([]);
  userRole = signal<UserRole>('user');

  // Form
  playerForm: FormGroup;
  formSubmitting = signal(false);
  formValid = signal(false);

  // Predefined options
  categories = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket Keeper'];
  positions = ['Top Order', 'Middle Order', 'Lower Order', 'Opening Bowler', 'Spin Bowler', 'Fast Bowler', 'Medium Pace'];
  nationalities = ['India', 'Australia', 'England', 'South Africa', 'New Zealand', 'Pakistan', 'Sri Lanka', 'Bangladesh', 'West Indies', 'Afghanistan', 'Other'];

  // Computed signal for admin status
  isAdmin = computed(() => this.userRole() === 'admin');

  // Computed values
  filteredPlayers = computed(() => {
    const players = this.players();
    const search = this.searchTerm().toLowerCase();
    const field = this.sortField();
    const direction = this.sortDirection();
    const categoryFilter = this.filterCategory();
    const positionFilter = this.filterPosition();

    // Filter by search term
    let filtered = players.filter(player => 
      player.name.toLowerCase().includes(search) ||
      player.position.toLowerCase().includes(search) ||
      player.category.toLowerCase().includes(search) ||
      (player.nationality && player.nationality.toLowerCase().includes(search))
    );

    // Filter by category
    if (categoryFilter) {
      filtered = filtered.filter(player => player.category === categoryFilter);
    }

    // Filter by position
    if (positionFilter) {
      filtered = filtered.filter(player => player.position === positionFilter);
    }

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

  selectedCount = computed(() => this.selectedPlayers().size);
  isAllSelected = computed(() => 
    this.filteredPlayers().length > 0 && 
    this.selectedPlayers().size === this.filteredPlayers().length
  );
  isFormValid = computed(() => this.formValid());

  // Statistics computed properties
  activePlayersCount = computed(() => this.players().filter(p => p.is_active).length);
  soldPlayersCount = computed(() => {
    // Players are considered sold if they are assigned to teams in the team_players table
    const soldIds = this.soldPlayerIds();
    return this.players().filter(p => soldIds.includes(p.id)).length;
  });
  unsoldPlayersCount = computed(() => {
    // Available players = Active players - Players assigned to teams
    const activePlayers = this.players().filter(p => p.is_active);
    const soldIds = this.soldPlayerIds();
    return activePlayers.filter(p => !soldIds.includes(p.id)).length;
  });

  // Table configuration
  displayedColumns: string[] = ['select', 'name', 'category', 'position', 'price', 'nationality', 'status', 'created', 'actions'];
  dataSource = computed(() => this.filteredPlayers());

  constructor(
    private playersService: PlayersService,
    private teamPlayersService: TeamPlayersService,
    private supabaseService: SupabaseService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    // Initialize form
    this.playerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      position: ['Middle Order'], // Default value for hidden field
      category: ['Batsman'], // Hidden field with default value
      subcategory: [''], // Hidden field
      base_price: [100000, [Validators.required, Validators.min(10000)]],
      image_url: [''], // Hidden field
      nationality: [''], // Hidden field
      age: [null, [Validators.min(16), Validators.max(50)]],
      experience_years: [null, [Validators.min(0), Validators.max(25)]] // Hidden field
    });

    // Use service signals directly
    this.players = this.playersService.players;
    this.loading = this.playersService.loading;
    this.error = this.playersService.error;
    
    // Subscribe to user role changes
    this.supabaseService.userRole.subscribe(role => {
      this.userRole.set(role);
    });
    
    // Subscribe to form changes to update validity signal
    this.playerForm.statusChanges.subscribe(() => {
      this.formValid.set(this.playerForm.valid);
    });
    
    this.playerForm.valueChanges.subscribe(() => {
      this.formValid.set(this.playerForm.valid);
    });
  }

  async ngOnInit() {
    await this.loadPlayers();
    await this.loadSoldPlayers();
  }

  // Data operations
  async loadPlayers() {
    const { error } = await this.playersService.getPlayers();
    if (error) {
      console.error('Error loading players:', error);
    }
  }

  async loadSoldPlayers() {
    const { data: soldIds, error } = await this.teamPlayersService.getSoldPlayers();
    if (error) {
      console.error('Error loading sold players:', error);
    } else {
      this.soldPlayerIds.set(soldIds || []);
    }
  }

  // Form operations
  openCreateForm() {
    this.editingPlayer.set(null);
    this.playerForm.reset({
      name: '',
      position: 'Middle Order',
      category: 'Batsman',
      subcategory: '',
      base_price: 100000,
      image_url: '',
      nationality: '',
      age: null,
      experience_years: null
    });
    this.formValid.set(this.playerForm.valid);
    this.showForm.set(true);
  }

  openEditForm(player: Player) {
    this.editingPlayer.set(player);
    this.playerForm.patchValue({
      name: player.name,
      position: player.position || 'Middle Order',
      category: player.category || 'Batsman',
      subcategory: player.subcategory || '',
      base_price: player.base_price,
      image_url: player.image_url || '',
      nationality: player.nationality || '',
      age: player.age,
      experience_years: player.experience_years
    });
    this.formValid.set(this.playerForm.valid);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingPlayer.set(null);
    this.playerForm.reset();
  }

  async onSubmit() {
    if (!this.isFormValid()) return;

    this.formSubmitting.set(true);
    const formData = this.playerForm.value;
    const editingPlayer = this.editingPlayer();

    try {
      if (editingPlayer) {
        // Update existing player
        const { error } = await this.playersService.updatePlayer(editingPlayer.id, formData as UpdatePlayerData);
        if (error) {
          this.snackBar.open(`Error updating player: ${error.message}`, 'Close', { 
            duration: 5000, 
            panelClass: ['error-snackbar'] 
          });
          return;
        }
        this.snackBar.open('Player updated successfully!', 'Close', { 
          duration: 3000, 
          panelClass: ['success-snackbar'] 
        });
      } else {
        // Create new player
        const { error } = await this.playersService.createPlayer(formData as CreatePlayerData);
        if (error) {
          this.snackBar.open(`Error creating player: ${error.message}`, 'Close', { 
            duration: 5000, 
            panelClass: ['error-snackbar'] 
          });
          return;
        }
        this.snackBar.open('Player created successfully!', 'Close', { 
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
  async deletePlayer(player: Player) {
    if (!confirm(`Are you sure you want to delete "${player.name}"? This action cannot be undone.`)) {
      return;
    }

    const { error } = await this.playersService.deletePlayer(player.id);
    if (error) {
      this.snackBar.open(`Error deleting player: ${error.message}`, 'Close', { 
        duration: 5000, 
        panelClass: ['error-snackbar'] 
      });
    } else {
      this.snackBar.open('Player deleted successfully!', 'Close', { 
        duration: 3000, 
        panelClass: ['success-snackbar'] 
      });
    }
  }

  async togglePlayerStatus(player: Player) {
    const { error } = await this.playersService.togglePlayerStatus(player.id);
    if (error) {
      this.snackBar.open(`Error toggling player status: ${error.message}`, 'Close', { 
        duration: 5000, 
        panelClass: ['error-snackbar'] 
      });
    } else {
      this.snackBar.open(`Player ${player.is_active ? 'deactivated' : 'activated'} successfully!`, 'Close', { 
        duration: 3000, 
        panelClass: ['success-snackbar'] 
      });
    }
  }

  // Selection operations
  toggleSelectAll() {
    const allSelected = this.isAllSelected();
    if (allSelected) {
      this.selectedPlayers.set(new Set());
    } else {
      const allIds = new Set(this.filteredPlayers().map(player => player.id));
      this.selectedPlayers.set(allIds);
    }
  }

  toggleSelectPlayer(playerId: string) {
    const selected = this.selectedPlayers();
    const newSelected = new Set(selected);
    
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      newSelected.add(playerId);
    }
    
    this.selectedPlayers.set(newSelected);
  }

  async deleteSelectedPlayers() {
    const selectedIds = Array.from(this.selectedPlayers());
    if (selectedIds.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected players? This action cannot be undone.`)) {
      return;
    }

    for (const playerId of selectedIds) {
      await this.playersService.deletePlayer(playerId);
    }

    this.selectedPlayers.set(new Set());
    this.snackBar.open(`${selectedIds.length} players deleted successfully!`, 'Close', { 
      duration: 3000, 
      panelClass: ['success-snackbar'] 
    });
  }

  // Sorting and filtering
  sort(field: keyof Player) {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  onSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  onCategoryFilter(category: string) {
    this.filterCategory.set(category);
  }

  onPositionFilter(position: string) {
    this.filterPosition.set(position);
  }

  clearFilters() {
    this.filterCategory.set('');
    this.filterPosition.set('');
    this.searchTerm.set('');
  }

  // Utility methods
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getStatusColor(player: Player): string {
    const soldIds = this.soldPlayerIds();
    if (soldIds.includes(player.id)) return 'accent';
    if (!player.is_active) return 'warn';
    return 'primary';
  }

  getStatusText(player: Player): string {
    const soldIds = this.soldPlayerIds();
    if (soldIds.includes(player.id)) return 'Sold';
    if (!player.is_active) return 'Inactive';
    return 'Available';
  }

  clearError() {
    this.playersService.clearError();
  }
} 