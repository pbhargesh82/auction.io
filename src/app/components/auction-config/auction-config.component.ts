import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuctionService, AuctionConfig } from '../../services/auction.service';

@Component({
  selector: 'app-auction-config',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatDialogModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './auction-config.component.html',
  styleUrls: ['./auction-config.component.css']
})
export class AuctionConfigComponent implements OnInit {
  // Reactive signals
  loading = signal(false);
  error = signal<string | null>(null);
  auctionConfig = signal<AuctionConfig | null>(null);

  // Form
  configForm: FormGroup;

  constructor(
    private auctionService: AuctionService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.configForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      budget_cap: [10000000, [Validators.required, Validators.min(1000000)]],
      max_players_per_team: [25, [Validators.required, Validators.min(10)]],
      min_players_per_team: [15, [Validators.required, Validators.min(5)]],
      auction_type: ['MANUAL', [Validators.required]]
    });
  }

  ngOnInit() {
    this.loadAuctionConfig();
  }

  async loadAuctionConfig() {
    this.loading.set(true);
    const { data, error } = await this.auctionService.getAuctionConfig();
    
    if (error) {
      this.error.set(error.message);
      this.snackBar.open(`Error loading auction config: ${error.message}`, 'Close', { duration: 5000 });
    } else if (data) {
      this.auctionConfig.set(data);
      this.configForm.patchValue({
        name: data.name,
        description: data.description,
        budget_cap: data.budget_cap,
        max_players_per_team: data.max_players_per_team,
        min_players_per_team: data.min_players_per_team,
        auction_type: data.auction_type
      });
    }
    this.loading.set(false);
  }

  async onSubmit() {
    if (!this.configForm.valid) return;

    this.loading.set(true);
    const formData = this.configForm.value;

    if (this.auctionConfig()) {
      // Update existing config
      const { data, error } = await this.auctionService.updateAuctionConfig(
        this.auctionConfig()!.id, 
        formData
      );
      
      if (error) {
        this.error.set(error.message);
        this.snackBar.open(`Error updating auction config: ${error.message}`, 'Close', { duration: 5000 });
      } else {
        this.snackBar.open('Auction configuration updated successfully!', 'Close', { duration: 3000 });
      }
    } else {
      // Create new config
      const { data, error } = await this.auctionService.createAuctionConfig(formData);
      
      if (error) {
        this.error.set(error.message);
        this.snackBar.open(`Error creating auction config: ${error.message}`, 'Close', { duration: 5000 });
      } else {
        this.snackBar.open('Auction configuration created successfully!', 'Close', { duration: 3000 });
      }
    }
    this.loading.set(false);
  }



  clearError(): void {
    this.error.set(null);
  }

  async refreshData() {
    console.log('Refreshing auction config data...');
    await this.loadAuctionConfig();
    console.log('Auction config data refreshed successfully');
  }
} 