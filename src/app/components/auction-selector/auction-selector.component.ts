import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuctionContextService, Auction } from '../../services/auction-context.service';

@Component({
    selector: 'app-auction-selector',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        MatIconModule,
        MatButtonModule,
        MatMenuModule,
        MatDividerModule,
        MatProgressSpinnerModule
    ],
    template: `
        <div class="auction-selector">
            @if (auctionContext.loading()) {
                <div class="flex items-center px-3 py-2 text-gray-400">
                    <mat-spinner diameter="20" class="mr-2"></mat-spinner>
                    <span class="text-sm">Loading...</span>
                </div>
            } @else {
                <button 
                    [matMenuTriggerFor]="auctionMenu"
                    class="flex items-center px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/20 text-white min-w-[180px]">
                    <mat-icon class="mr-2 text-amber-400">emoji_events</mat-icon>
                    <span class="flex-1 text-left text-sm font-medium truncate">
                        @if (auctionContext.currentAuction()) {
                            {{ auctionContext.currentAuction()!.name }}
                        } @else {
                            Select Auction
                        }
                    </span>
                    <mat-icon class="ml-2 text-gray-400">expand_more</mat-icon>
                </button>

                <mat-menu #auctionMenu="matMenu" class="auction-menu">
                    @if (auctionContext.userAuctions().length === 0) {
                        <div class="px-4 py-3 text-gray-500 text-sm">
                            No auctions yet
                        </div>
                    } @else {
                        @for (auction of auctionContext.userAuctions(); track auction.id) {
                            <button 
                                mat-menu-item 
                                (click)="selectAuction(auction)"
                                class="auction-item"
                                [class.active]="auction.id === auctionContext.currentAuctionId()">
                                <div class="flex items-center w-full">
                                    <mat-icon 
                                        class="mr-3"
                                        [class.text-amber-500]="auction.id === auctionContext.currentAuctionId()"
                                        [class.text-gray-400]="auction.id !== auctionContext.currentAuctionId()">
                                        {{ getStatusIcon(auction.status) }}
                                    </mat-icon>
                                    <div class="flex-1 min-w-0">
                                        <div class="font-medium truncate">{{ auction.name }}</div>
                                        <div class="text-xs text-gray-500">{{ getStatusLabel(auction.status) }}</div>
                                    </div>
                                    @if (auction.id === auctionContext.currentAuctionId()) {
                                        <mat-icon class="text-green-500 ml-2">check</mat-icon>
                                    }
                                </div>
                            </button>
                        }
                    }
                    
                    <mat-divider></mat-divider>
                    
                    <button mat-menu-item routerLink="/auctions" class="text-indigo-600">
                        <mat-icon class="text-indigo-600">settings</mat-icon>
                        <span>Manage Auctions</span>
                    </button>
                    
                    <button mat-menu-item (click)="createNewAuction()" class="text-green-600">
                        <mat-icon class="text-green-600">add_circle</mat-icon>
                        <span>Create New Auction</span>
                    </button>
                </mat-menu>
            }
        </div>
    `,
    styles: [`
        .auction-selector {
            display: inline-flex;
        }
        
        .auction-item {
            min-width: 250px;
        }
        
        .auction-item.active {
            background-color: rgba(99, 102, 241, 0.1);
        }
        
        :host ::ng-deep .mat-mdc-menu-panel {
            max-width: 320px !important;
        }
    `]
})
export class AuctionSelectorComponent {
    auctionContext = inject(AuctionContextService);

    selectAuction(auction: Auction): void {
        this.auctionContext.selectAuction(auction.id);
    }

    createNewAuction(): void {
        // TODO: Open create auction dialog or navigate to auctions page
        // For now, navigate to auctions page
    }

    getStatusIcon(status: string): string {
        switch (status) {
            case 'active': return 'play_circle';
            case 'paused': return 'pause_circle';
            case 'completed': return 'check_circle';
            default: return 'edit_note';
        }
    }

    getStatusLabel(status: string): string {
        switch (status) {
            case 'active': return 'Live';
            case 'paused': return 'Paused';
            case 'completed': return 'Completed';
            default: return 'Draft';
        }
    }
}
