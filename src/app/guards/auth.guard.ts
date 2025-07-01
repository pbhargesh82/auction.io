import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  // Wait for auth initialization before checking user state
  return from(supabaseService.waitForAuthInitialization()).pipe(
    map(user => {
      if (user) {
        return true;
      } else {
        router.navigate(['/login'], { 
          queryParams: { returnUrl: state.url }
        });
        return false;
      }
    })
  );
}; 