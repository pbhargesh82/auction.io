import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="containerClasses()">
      @if (_src() && !imageError()) {
        <img [src]="_src()" 
             (error)="onImageError()"
             [class]="imageClasses()" 
             [alt]="_fallbackText() || 'Avatar'" />
      } @else {
        <span [class]="fallbackClasses()">
          {{ initial() }}
        </span>
      }
      
      <!-- Optional Online/Active Indicator (for Teams/Users) -->
      @if (_showIndicator()) {
        <div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#393E46]" 
             [class]="_indicatorActive() ? 'bg-[#4ECCA3]' : 'bg-red-400'">
        </div>
      }
    </div>
  `
})
export class AvatarComponent {
  @Input() set src(value: string | null | undefined) { this._src.set(value); }
  @Input() set fallbackText(value: string | null | undefined) { this._fallbackText.set(value); }
  @Input() set shape(value: 'circle' | 'square') { this._shape.set(value); }
  @Input() set size(value: 'sm' | 'md' | 'lg' | 'xl' | '2xl') { this._size.set(value); }
  @Input() set showIndicator(value: boolean) { this._showIndicator.set(value); }
  @Input() set indicatorActive(value: boolean) { this._indicatorActive.set(value); }

  _src = signal<string | null | undefined>(null);
  _fallbackText = signal<string | null | undefined>(null);
  _shape = signal<'circle' | 'square'>('circle');
  _size = signal<'sm' | 'md' | 'lg' | 'xl' | '2xl'>('md');
  
  _showIndicator = signal<boolean>(false);
  _indicatorActive = signal<boolean>(false);
  imageError = signal<boolean>(false);

  onImageError() {
    this.imageError.set(true);
  }

  initial = computed(() => {
    const text = this._fallbackText();
    if (!text) return '?';
    return text.charAt(0).toUpperCase();
  });

  containerClasses = computed(() => {
    const shapeStr = this._shape() === 'circle' ? 'rounded-full' : 'rounded-xl';
    
    // Core structure
    let base = `relative shrink-0 flex items-center justify-center overflow-visible ${shapeStr}`;
    
    // Size logic
    switch (this._size()) {
      case 'sm': base += ' w-8 h-8'; break;
      case 'md': base += ' w-10 h-10'; break;
      case 'lg': base += ' w-12 h-12'; break;
      case 'xl': base += ' w-20 h-20 rounded-[1.5rem]'; break; // Override for xl square
      case '2xl': base += ' w-40 h-40 sm:w-48 sm:h-48 border-4 border-[#232931] shadow-2xl'; break;
    }

    // Default Fallback styling applied to container if no image
    if (!this._src() || this.imageError()) {
      base += ' bg-[#232931] border border-[#4ECCA3]/10';
      
      // Add gradient for larger avatars
      if (this._size() === '2xl') {
         base += ' bg-gradient-to-br from-[#4ECCA3]/20 to-[#232931]';
      }
    }

    return base;
  });

  imageClasses = computed(() => {
    const shapeStr = this._shape() === 'circle' ? 'rounded-full' : 'rounded-xl';
    
    // Core structure
    let base = `w-full h-full object-cover ring-1 ring-[#EEEEEE]/10 shadow-sm ${shapeStr}`;

    if (this._size() === 'xl' && this._shape() === 'square') {
      base = `w-full h-full object-cover border-2 border-[#4ECCA3]/20 shadow-2xl rounded-[1.5rem]`;
    }

    return base;
  });

  fallbackClasses = computed(() => {
    let base = 'text-[#4ECCA3] font-black mix-blend-plus-lighter';
    
    switch (this._size()) {
      case 'sm': base += ' text-[10px]'; break;
      case 'md': base += ' text-sm'; break;
      case 'lg': base += ' text-lg'; break;
      case 'xl': base += ' text-3xl'; break;
      case '2xl': base += ' text-5xl'; break;
    }

    return base;
  });
}
