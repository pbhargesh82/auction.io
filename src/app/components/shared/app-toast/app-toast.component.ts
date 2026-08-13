import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (toast(); as toast) {
    <div
      class="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-[200] max-w-sm w-full sm:w-auto bg-[#393E46] border border-[#EEEEEE]/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-4 flex items-center gap-3 animate-fade-in-up"
      [ngClass]="{ 'border-red-500/50': toast.type === 'error' }"
      role="alert">
      @if (toast.type === 'success') {
      <div class="flex-shrink-0 w-8 h-8 bg-[#4ECCA3]/20 rounded-full flex items-center justify-center text-[#4ECCA3]">
        <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      } @else {
      <div class="flex-shrink-0 w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center text-red-500">
        <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      }
      <p class="text-sm font-semibold text-[#EEEEEE] flex-1 min-w-0">{{ toast.message }}</p>
      <button type="button" (click)="dismiss()"
              class="flex-shrink-0 text-[#EEEEEE]/40 hover:text-[#EEEEEE] transition-colors focus:outline-none"
              aria-label="Dismiss notification">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
    }
  `
})
export class AppToastComponent {
  private readonly toastService = inject(ToastService);
  readonly toast = this.toastService.toast;

  dismiss(): void {
    this.toastService.dismiss();
  }
}
