import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { AuctionStateService } from '../../services/auction-state.service';
import { TeamPlayersService } from '../../services/team-players.service';
import { SupabaseService } from '../../services/supabase.service';
import { AvatarComponent } from '../shared/avatar/avatar.component';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-team-roster',
  standalone: true,
  imports: [CommonModule, AvatarComponent],
  templateUrl: './team-roster.component.html',
  styleUrls: ['./team-roster.component.css'],
  host: { class: 'block h-full w-full min-h-0' }
})
export class TeamRosterComponent implements OnInit {
  // Use centralized state service
  loading;
  error;

  // Admin role signal
  isAdmin = signal(false);

  // Selling state for UX
  sellingPlayer = signal<string | null>(null);
  exportingPdf = signal(false);

  // All Teams with their Rosters
  teamsWithRosters = computed(() => {
    const teams = this.auctionStateService.teams();
    const teamPlayers = this.auctionStateService.teamPlayers();
    
    return teams.map(team => ({
      ...team,
      players: teamPlayers
        .filter(tp => tp.team_id === team.id)
        .map(tp => ({
          ...tp.player,
          purchase_price: tp.purchase_price,
          purchased_at: tp.purchased_at,
          team_player_id: tp.id // Add team_player_id for sell-back functionality
        }))
        .filter(player => player !== null && player !== undefined) || []
    }));
  });

  constructor(
    private auctionStateService: AuctionStateService,
    private teamPlayersService: TeamPlayersService,
    private supabaseService: SupabaseService,
    private route: ActivatedRoute,
    private toast: ToastService,
  ) {
    this.loading = this.auctionStateService.loading;
    this.error = this.auctionStateService.error;

    // Subscribe to admin role changes
    this.supabaseService.isAdmin.subscribe(isAdmin => {
      this.isAdmin.set(isAdmin);
    });
  }

  async ngOnInit() {
    await this.auctionStateService.loadAllData(this.auctionId());
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

  // Sell player back to auction pool
  async sellPlayerBack(player: any, teamName: string) {
    if (!player.team_player_id) {
      this.toast.error('Player data is incomplete');
      return;
    }

    // Show confirmation dialog
    const confirmed = confirm(
      `Are you sure you want to sell ${player.name} back to the auction pool?\n\n` +
      `This will:\n` +
      `• Remove the player from ${teamName}\n` +
      `• Refund ₹${this.formatNumber(player.purchase_price)} to the team budget\n` +
      `• Make the player available for auction again\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    this.sellingPlayer.set(player.id);

    try {
      const { error } = await this.teamPlayersService.sellPlayerBackToPool(player.team_player_id);

      if (error) {
        throw error;
      }

      this.toast.success(`Successfully sold ${player.name} back to auction pool. Refunded ₹${this.formatNumber(player.purchase_price)}.`);

      // Refresh data to show updated team budgets and player lists
      await this.auctionStateService.loadAllData(this.auctionId());

    } catch (error: any) {
      this.toast.error(`Error: ${error.message}`);
    } finally {
      this.sellingPlayer.set(null);
    }
  }

  // Check if player is currently being sold back
  isSellingPlayer(playerId: string): boolean {
    return this.sellingPlayer() === playerId;
  }

  // Budget calculations
  getBudgetPercentage(spent: number, cap: number): number {
    if (!cap) return 0;
    return (spent / cap) * 100;
  }

  getPlayerPercentage(count: number, max: number): number {
    if (!max) return 0;
    return (count / max) * 100;
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('en-IN').format(num);
  }
  async exportSquadsPdf() {
    const teams = this.teamsWithRosters();
    if (teams.length === 0) {
      this.toast.error('There are no squads to export yet.');
      return;
    }

    this.exportingPdf.set(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageBottom = pageHeight - 14;
      let y = 18;

      const addPage = () => {
        doc.addPage();
        y = 18;
      };
      const addTeamHeader = (team: any, continuation = false) => {
        if (y + 20 > pageBottom) addPage();
        const color = this.hexToRgb(team.primary_color);
        doc.setFillColor(color.r, color.g, color.b);
        doc.roundedRect(12, y, pageWidth - 24, 10, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(this.truncatePdfText(team.name || 'Unnamed Team', 42) + (continuation ? ' (continued)' : ''), 16, y + 6.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`${team.players.length || 0}/${team.max_players || 0} players  |  Budget left: INR ${this.formatNumber(team.budget_remaining || 0)}`, pageWidth - 16, y + 6.3, { align: 'right' });
        y += 15;
        doc.setTextColor(95, 105, 115);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('PLAYER', 16, y);
        doc.text('CATEGORY', 82, y);
        doc.text('POSITION', 123, y);
        doc.text('PURCHASE PRICE', pageWidth - 16, y, { align: 'right' });
        y += 4;
      };

      doc.setProperties({ title: 'Current Squads', subject: 'Auction team rosters' });
      doc.setFillColor(35, 41, 49);
      doc.rect(0, 0, pageWidth, 31, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('CURRENT SQUADS', 12, 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(`${teams.length} teams  |  Generated ${new Date().toLocaleString('en-IN')}`, 12, 22);
      y = 40;

      for (const team of teams) {
        addTeamHeader(team);
        if (team.players.length === 0) {
          doc.setTextColor(120, 128, 138);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8.5);
          doc.text('No players drafted', 16, y + 2);
          y += 10;
          continue;
        }

        for (const player of team.players) {
          if (y + 8 > pageBottom) {
            addPage();
            addTeamHeader(team, true);
          }
          doc.setDrawColor(225, 229, 233);
          doc.line(16, y + 2.5, pageWidth - 16, y + 2.5);
          doc.setTextColor(38, 45, 53);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.text(this.truncatePdfText(player.name || 'Unknown player', 34), 16, y);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(this.truncatePdfText(player.category || 'Uncategorized', 18), 82, y);
          doc.text(this.truncatePdfText(player.position || '-', 18), 123, y);
          doc.setFont('helvetica', 'bold');
          doc.text(`INR ${this.formatNumber(player.purchase_price || 0)}`, pageWidth - 16, y, { align: 'right' });
          y += 7;
        }
        y += 5;
      }

      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);
        doc.setDrawColor(225, 229, 233);
        doc.line(12, pageHeight - 10, pageWidth - 12, pageHeight - 10);
        doc.setTextColor(120, 128, 138);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('Auction.io - Current Squads', 12, pageHeight - 6);
        doc.text(`Page ${page} of ${pageCount}`, pageWidth - 12, pageHeight - 6, { align: 'right' });
      }

      const date = new Date().toISOString().slice(0, 10);
      doc.save(`current-squads-${date}.pdf`);
      this.toast.success('Current squads PDF downloaded.');
    } catch (error: any) {
      console.error('Failed to export current squads PDF:', error);
      this.toast.error('Could not export the squads PDF. Please try again.');
    } finally {
      this.exportingPdf.set(false);
    }
  }

  private truncatePdfText(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
  }

  private hexToRgb(value?: string): { r: number; g: number; b: number } {
    const normalized = (value || '#4ECCA3').replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return { r: 78, g: 204, b: 163 };
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16)
    };
  }
}