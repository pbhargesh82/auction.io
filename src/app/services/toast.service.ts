import { Injectable, signal, NgZone, inject } from '@angular/core';

export type ToastType = 'success' | 'error';

export interface ToastState {
  message: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly ngZone = inject(NgZone);
  private _toast = signal<ToastState | null>(null);
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

  toast = this._toast.asReadonly();

  success(message: string, durationMs = 3500): void {
    this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs = 5000): void {
    this.show(message, 'error', durationMs);
  }

  dismiss(): void {
    this.clearTimer();
    this.ngZone.run(() => {
      this._toast.set(null);
    });
  }

  private show(message: string, type: ToastType, durationMs: number): void {
    this.clearTimer();
    this.ngZone.run(() => {
      this._toast.set({ message, type });
    });
    this.dismissTimer = setTimeout(() => this.ngZone.run(() => this.dismiss()), durationMs);
  }

  private clearTimer(): void {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
  }
}
