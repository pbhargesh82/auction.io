import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PlayersService, Player, CreatePlayerData, UpdatePlayerData } from '../../services/players.service';
import { TeamPlayersService } from '../../services/team-players.service';
import { SupabaseService, UserRole } from '../../services/supabase.service';
import { ImageUploadService } from '../../services/image-upload.service';

import { MatIconModule } from '@angular/material/icon';
import { AvatarComponent } from '../shared/avatar/avatar.component';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatIconModule,
    AvatarComponent
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
  filterStatus = signal<string>('');
  soldPlayerIds = signal<string[]>([]);
  userRole = signal<UserRole>('user');

  // Image upload signals
  photoPreview = signal<string | null>(null);
  uploadingPhoto = signal(false);

  // Scroll position preservation
  scrollPosition = signal<number>(0);

  // Form
  playerForm: FormGroup;
  formSubmitting = signal(false);
  formValid = signal(false);

  // Toast notification
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  private toastTimer: any;

  // Predefined options
  categories = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'];
  specializations: { [key: string]: string[] } = {
    'Batsman': ['Right-Hand Bat', 'Left-Hand Bat', 'Opener', 'Middle Order', 'Finisher'],
    'Bowler': ['Fast Bowler', 'Medium Fast', 'Off Spinner', 'Leg Spinner', 'Left-Arm Spinner', 'Left-Arm Pace'],
    'All-Rounder': ['Batting All-Rounder', 'Bowling All-Rounder'],
    'Wicket-Keeper': ['Wicket-Keeper Batsman']
  };
  statuses = ['Available', 'Sold', 'Inactive'];

  // Computed signal for admin status
  isAdmin = computed(() => this.userRole() === 'super_admin');

  // Computed values
  filteredPlayers = computed(() => {
    const players = this.players();
    const search = this.searchTerm().toLowerCase();
    const field = this.sortField();
    const direction = this.sortDirection();
    const categoryFilter = this.filterCategory();
    const positionFilter = this.filterPosition();
    const statusFilter = this.filterStatus();

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

    // Filter by status
    if (statusFilter) {
      const soldIds = this.soldPlayerIds();
      filtered = filtered.filter(player => {
        if (statusFilter === 'Sold') {
          return soldIds.includes(player.id);
        } else if (statusFilter === 'Available') {
          return player.is_active && !soldIds.includes(player.id);
        } else if (statusFilter === 'Inactive') {
          return !player.is_active;
        }
        return true;
      });
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
    private imageUploadService: ImageUploadService,
    private fb: FormBuilder
  ) {
    // Initialize form with enhanced fields
    this.playerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      category: ['Batsman', Validators.required],
      specialization: [''],
      base_price: [100000, [Validators.required, Validators.min(1000)]],
      image_url: [''],
      age: [null, [Validators.min(16), Validators.max(50)]],
      experience_years: [null, [Validators.min(0), Validators.max(30)]],
      bio: ['', [Validators.maxLength(500)]]
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
    // Save current scroll position before opening form
    this.scrollPosition.set(window.scrollY);

    this.editingPlayer.set(null);
    this.photoPreview.set(null);
    this.playerForm.reset({
      name: '',
      category: 'Batsman',
      specialization: '',
      base_price: 100000,
      image_url: '',
      age: null,
      experience_years: null,
      bio: ''
    });
    this.formValid.set(this.playerForm.valid);
    this.showForm.set(true);
  }

  openEditForm(player: Player) {
    // Save current scroll position before opening form
    this.scrollPosition.set(window.scrollY);

    this.editingPlayer.set(player);
    this.photoPreview.set(player.image_url || null);
    this.playerForm.patchValue({
      name: player.name,
      category: player.position || 'Batsman',
      specialization: player.category || '',
      base_price: player.base_price,
      image_url: player.image_url || '',
      age: player.age,
      experience_years: player.experience_years,
      bio: player.bio || ''
    });
    this.formValid.set(this.playerForm.valid);
    this.showForm.set(true);
  }

  closeForm() {
    // Check if we were editing before closing
    const wasEditing = this.editingPlayer() !== null;

    this.showForm.set(false);
    this.editingPlayer.set(null);
    this.photoPreview.set(null);
    this.playerForm.reset();

    // Restore scroll position when form is closed (for cancel/close actions)
    if (wasEditing) {
      this.restoreScrollPosition();
    }
  }

  // Handle photo file selection
  async onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.uploadingPhoto.set(true);

    try {
      // Compress image before upload
      const compressedFile = await this.imageUploadService.compressImage(file, 400, 0.8);

      // Upload to Supabase Storage
      const result = await this.imageUploadService.uploadImage(compressedFile, 'players');

      if (result.success && result.url) {
        this.photoPreview.set(result.url);
        this.playerForm.patchValue({ image_url: result.url });
        this.notify('Photo uploaded successfully');
      } else {
        this.notify(`Upload failed: ${result.error}`, 'error');
      }
    } catch (err: any) {
      this.notify(`Upload error: ${err.message}`, 'error');
    } finally {
      this.uploadingPhoto.set(false);
    }
  }

  // Remove photo
  removePhoto() {
    this.photoPreview.set(null);
    this.playerForm.patchValue({ image_url: '' });
  }

  // Get specializations for current category
  getSpecializations(): string[] {
    const category = this.playerForm.get('category')?.value;
    return this.specializations[category] || [];
  }

  // Restore scroll position after form closes
  private restoreScrollPosition() {
    setTimeout(() => {
      window.scrollTo({
        top: this.scrollPosition(),
        behavior: 'smooth'
      });
    }, 100); // Small delay to ensure DOM is updated
  }

  async onSubmit() {
    if (!this.isFormValid()) return;

    this.formSubmitting.set(true);
    const formData = this.playerForm.value;
    const editingPlayer = this.editingPlayer();

    // Map form data back to database columns
    const dbData: any = {
      name: formData.name,
      position: formData.category, // Form category -> DB position
      category: formData.specialization, // Form specialization -> DB category
      base_price: formData.base_price,
      image_url: formData.image_url,
      age: formData.age,
      experience_years: formData.experience_years,
      bio: formData.bio
    };

    try {
      if (editingPlayer) {
        // Update existing player
        const { error } = await this.playersService.updatePlayer(editingPlayer.id, dbData as UpdatePlayerData);
        if (error) {
          this.notify(`Error updating player: ${error.message}`, 'error');
          return;
        }
        this.notify('Player updated successfully!');
      } else {
        // Create new player
        const { error } = await this.playersService.createPlayer(dbData as CreatePlayerData);
        if (error) {
          this.notify(`Error creating player: ${error.message}`, 'error');
          return;
        }
        this.notify('Player created successfully!');
      }

      this.closeForm();
      // Restore scroll position after successful submission
      this.restoreScrollPosition();
    } catch (error: any) {
      this.notify(`Error: ${error.message}`, 'error');
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
      this.notify(`Error deleting player: ${error.message}`, 'error');
    } else {
      this.notify('Player deleted successfully!');
    }
  }

  async togglePlayerStatus(player: Player) {
    const { error } = await this.playersService.togglePlayerStatus(player.id);
    if (error) {
      this.notify(`Error toggling player status: ${error.message}`, 'error');
    } else {
      this.notify(`Player ${player.is_active ? 'deactivated' : 'activated'} successfully!`);
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
    this.notify(`${selectedIds.length} players deleted successfully!`);
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

  onStatusFilter(status: string) {
    this.filterStatus.set(status);
  }

  onStatusFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.filterStatus.set(target.value);
  }

  clearFilters() {
    this.filterCategory.set('');
    this.filterPosition.set('');
    this.filterStatus.set('');
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

  notify(message: string, type: 'success' | 'error' = 'success') {
    clearTimeout(this.toastTimer);
    this.toast.set({ message, type });
    this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
  }
}