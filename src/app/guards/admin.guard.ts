import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Admin Guard - Protects routes that require admin access
 * 
 * Usage in routes:
 * { path: 'admin-only-page', component: AdminComponent, canActivate: [adminGuard] }
 */
export const adminGuard: CanActivateFn = (route, state) => {
    const supabaseService = inject(SupabaseService);
    const router = inject(Router);

    // Wait for auth initialization before checking user role
    return from(supabaseService.waitForAuthInitialization()).pipe(
        map(user => {
            if (!user) {
                // Not authenticated - redirect to login
                router.navigate(['/login'], {
                    queryParams: { returnUrl: state.url }
                });
                return false;
            }

            // Check if user has admin role
            if (supabaseService.isAdminValue) {
                return true;
            } else {
                // User is authenticated but not admin - redirect to dashboard
                console.warn('Access denied: Admin role required for', state.url);
                router.navigate(['/dashboard']);
                return false;
            }
        })
    );
};
