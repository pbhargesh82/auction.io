import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  isDarkMode = signal<boolean>(false);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Load saved preference
      const savedTheme = localStorage.getItem('app-theme');
      if (savedTheme === 'dark') {
        this.isDarkMode.set(true);
      } else if (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        this.isDarkMode.set(true);
      }

      // Apply initial theme
      this.applyTheme(this.isDarkMode());

      // React to changes
      effect(() => {
        const isDark = this.isDarkMode();
        this.applyTheme(isDark);
        localStorage.setItem('app-theme', isDark ? 'dark' : 'light');
      });
    }
  }

  toggleTheme() {
    this.isDarkMode.update(dark => !dark);
  }

  private applyTheme(isDark: boolean) {
    if (!isPlatformBrowser(this.platformId)) return;
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}
