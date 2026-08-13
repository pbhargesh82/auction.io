import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  inject,
  OnDestroy,
  PLATFORM_ID,
  afterNextRender,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-side-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './side-panel.component.html',
})
export class SidePanelComponent implements OnDestroy {
  @Input({ required: true }) isOpen = false;
  @Input() title = '';
  @Input() subtitle = '';

  @Output() closePanel = new EventEmitter<void>();

  private host = inject(ElementRef<HTMLElement>);
  private doc = inject(DOCUMENT);
  private platformId = inject(PLATFORM_ID);
  private anchor: Comment | null = null;

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      this.portalToBody();
    });

    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      this.doc.body.style.overflow = this.isOpen ? 'hidden' : '';
    });
  }

  /** Escape overflow/stacking contexts in workspace & global layouts so the panel covers the header. */
  private portalToBody(): void {
    const el = this.host.nativeElement;
    const parent = el.parentNode;
    if (!parent || parent === this.doc.body) return;

    this.anchor = this.doc.createComment('app-side-panel-anchor');
    parent.insertBefore(this.anchor, el);
    this.doc.body.appendChild(el);
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const el = this.host.nativeElement;
    if (el.parentNode === this.doc.body && this.anchor?.parentNode) {
      this.anchor.parentNode.insertBefore(el, this.anchor);
      this.anchor.remove();
    }

    if (!this.doc.querySelector('app-side-panel')) {
      this.doc.body.style.overflow = '';
    }
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closePanel.emit();
    }
  }
}
