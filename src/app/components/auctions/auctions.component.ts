import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuctionsService } from '../../services/auctions.service';
import { AuctionStateService } from '../../services/auction-state.service';
import { Auction } from '../../services/auctions.service';

// Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
    selector: 'app-auctions',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        RouterModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
        MatInputModule,
        MatFormFieldModule,
        MatSelectModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatMenuModule,
        MatDialogModule
    ],
    templateUrl: './auctions.component.html',
    styleUrls: ['./auctions.component.css']
})
export class AuctionsComponent implements OnInit {
    // State signals
    showCreateForm = signal(false);
    editingAuction = signal<Auction | null>(null);
    submitting = signal(false);
    deletingId = signal<string | null>(null);

    // Form
    auctionForm: FormGroup;

    // Computed
    auctions = computed(() => this.auctionsSvc.auctions());
    loading = computed(() => this.auctionsSvc.loading());
    currentAuctionId = computed(() => this.auctionStateSvc.auctionConfig()?.id);

    constructor(
        private auctionsSvc: AuctionsService,
        private auctionStateSvc: AuctionStateService,
        private fb: FormBuilder,
        private snackBar: MatSnackBar,
        private router: Router,
    ) {
        this.auctionForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(3)]],
            description: [''],
            budget_per_team: [10000000, [Validators.required, Validators.min(1000)]],
            max_players_per_team: [25, [Validators.required, Validators.min(1)]],
            min_players_per_team: [15, [Validators.required, Validators.min(1)]],
            is_public: [true]
        });
    }

    async ngOnInit() {
        await this.auctionsSvc.loadAuctions();
    }

    // Open create form
    openCreateForm() {
        this.editingAuction.set(null);
        this.auctionForm.reset({
            name: '',
            description: '',
            budget_per_team: 10000000,
            max_players_per_team: 25,
            min_players_per_team: 15,
            is_public: true
        });
        this.showCreateForm.set(true);
    }

    // Open edit form
    openEditForm(auction: Auction) {
        this.editingAuction.set(auction);
        this.auctionForm.patchValue({
            name: auction.name,
            description: auction.description,
            budget_per_team: auction.budget_per_team,
            max_players_per_team: auction.max_players_per_team,
            min_players_per_team: auction.min_players_per_team,
            is_public: auction.is_public
        });
        this.showCreateForm.set(true);
    }

    // Close form
    closeForm() {
        this.showCreateForm.set(false);
        this.editingAuction.set(null);
    }

    // Submit form (create or update)
    async submitForm() {
        if (this.auctionForm.invalid) return;

        this.submitting.set(true);
        const formValue = this.auctionForm.value;

        try {
            if (this.editingAuction()) {
                // Update
                const { error } = await this.auctionsSvc.updateAuction(
                    this.editingAuction()!.id,
                    formValue
                );

                if (error) {
                    this.showError('Failed to update auction: ' + error.message);
                } else {
                    this.showSuccess('Auction updated successfully');
                    this.closeForm();
                }
            } else {
                // Create
                const { error } = await this.auctionsSvc.createAuction(formValue);

                if (error) {
                    this.showError('Failed to create auction: ' + error.message);
                } else {
                    this.showSuccess('Auction created successfully');
                    this.closeForm();
                }
            }
        } finally {
            this.submitting.set(false);
        }
    }

    // Delete auction
    async deleteAuction(auction: Auction) {
        if (!confirm(`Are you sure you want to delete "${auction.name}"? This will delete all teams and data in this auction.`)) {
            return;
        }

        this.deletingId.set(auction.id);

        try {
            const { error } = await this.auctionsSvc.deleteAuction(auction.id);

            if (error) {
                this.showError('Failed to delete auction: ' + error.message);
            } else {
                this.showSuccess('Auction deleted successfully');
            }
        } finally {
            this.deletingId.set(null);
        }
    }

    // Navigate into the auction workspace
    selectAuction(auction: Auction) {
        this.router.navigate(['/auction', auction.id, 'overview']);
    }

    // Copy share link
    copyShareLink(auction: Auction) {
        const url = `${window.location.origin}/view/${auction.public_slug}`;
        navigator.clipboard.writeText(url);
        this.showSuccess('Share link copied to clipboard');
    }

    // Get status badge config
    getStatusConfig(status: string): { label: string; color: string; bgColor: string } {
        switch (status) {
            case 'active':
                return { label: 'Live', color: 'text-green-700', bgColor: 'bg-green-100' };
            case 'paused':
                return { label: 'Paused', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
            case 'completed':
                return { label: 'Completed', color: 'text-blue-700', bgColor: 'bg-blue-100' };
            default:
                return { label: 'Draft', color: 'text-gray-700', bgColor: 'bg-gray-100' };
        }
    }

    // Format currency
    formatCurrency(value: number): string {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(value);
    }

    // Format date
    formatDate(dateString: string): string {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    private showSuccess(message: string) {
        this.snackBar.open(message, 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
        });
    }

    private showError(message: string) {
        this.snackBar.open(message, 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
        });
    }
}
