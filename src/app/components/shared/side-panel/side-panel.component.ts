import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-side-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './side-panel.component.html'
})
export class SidePanelComponent {
  @Input({ required: true }) isOpen = false;
  @Input() title = '';
  @Input() subtitle = '';

  @Output() closePanel = new EventEmitter<void>();

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closePanel.emit();
    }
  }
}
