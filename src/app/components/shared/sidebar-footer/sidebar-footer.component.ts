import { Component, Input, OnInit, computed, signal, OnDestroy } from '@angular/core';
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
  @Input() collapsed = false;

  user = signal<any>(null);
  userRole = signal<string>('user');
  
  appVersion = computed(() => this.versionService.getVersionWithPrefix());
  appVersionShort = computed(() => this.versionService.getShortVersionWithPrefix());
  
  userDisplayName = computed(() => {
    const u = this.user();
    return u?.email ? u.email.split('@')[0] : 'User';
  });
  
  isAdmin = computed(() => this.userRole() === 'super_admin');

  private subs = new Subscription();

  constructor(
    private supabaseService: SupabaseService,
    private versionService: VersionService,
    private router: Router
  ) {}

  ngOnInit() {
    this.subs.add(this.supabaseService.currentUser.subscribe(u => this.user.set(u)));
    this.subs.add(this.supabaseService.userRole.subscribe(r => this.userRole.set(r)));
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
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
