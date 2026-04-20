import { Component, OnInit, computed, signal, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../services/supabase.service';
import { VersionService } from '../../../services/version.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar-footer.component.html'
})
export class SidebarFooterComponent implements OnInit, OnDestroy {
  // Input collapsed removed since this now strictly operates in headers.

  user = signal<any>(null);
  userRole = signal<string>('user');
  menuOpen = signal<boolean>(false);
  
  // Versions no longer render inside this component (moved directly to sidebar bottoms)
  // but kept logic in case it's needed elsewhere.
  
  userDisplayName = computed(() => {
    const u = this.user();
    return u?.email ? u.email.split('@')[0] : 'User';
  });
  
  isAdmin = computed(() => this.userRole() === 'super_admin');

  private subs = new Subscription();

  constructor(
    private supabaseService: SupabaseService,
    private versionService: VersionService,
    private router: Router,
    private eRef: ElementRef
  ) {}

  ngOnInit() {
    this.subs.add(this.supabaseService.currentUser.subscribe(u => this.user.set(u)));
    this.subs.add(this.supabaseService.userRole.subscribe(r => this.userRole.set(r)));
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  toggleMenu() {
    this.menuOpen.set(!this.menuOpen());
  }

  // Close dropdown if click occurs outside the component
  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if(!this.eRef.nativeElement.contains(event.target)) {
      this.menuOpen.set(false);
    }
  }

  async onSignOut() {
    try {
      await this.supabaseService.signOut();
      this.router.navigate(['/login']);
    } catch (e) {
      console.error(e);
    }
  }
}
