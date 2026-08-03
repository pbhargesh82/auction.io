import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Auction Workspace Guard — Phase 1.4
 *
 * Runs before any `/auction/:id/*` route activates. It:
 *  1. Reads `:id` from the URL.
 *  2. Validates the auction exists in the DB.
 *  3. Validates the current user owns it (or is super_admin).
 *  4. Pre-loads all auction data into AuctionStateService.
 *  5. Redirects to /home if anything fails.
 *
 * AuctionStateService is dynamically imported so the workspace realtime bundle
 * stays out of the initial cold-start chunk.
 */
export const auctionWorkspaceGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot
) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  const user = await supabaseService.waitForAuthInitialization();
  if (!user) {
    router.navigate(['/login'], { queryParams: { returnUrl: route.url.join('/') } });
    return false;
  }

  const auctionId = route.paramMap.get('id');
  if (!auctionId) {
    router.navigate(['/home']);
    return false;
  }

  try {
    const { data: auction, error } = await supabaseService.db
      .from('auctions')
      .select('id, owner_id, status')
      .eq('id', auctionId)
      .maybeSingle();

    if (error || !auction) {
      console.warn(`[auctionWorkspaceGuard] Auction "${auctionId}" not found.`);
      router.navigate(['/home']);
      return false;
    }

    const isOwner = auction.owner_id === user.id;
    const isAdmin = supabaseService.isAdminValue;

    if (!isOwner && !isAdmin) {
      console.warn(`[auctionWorkspaceGuard] User does not own auction "${auctionId}".`);
      router.navigate(['/home']);
      return false;
    }

    const { AuctionStateService } = await import('../services/auction-state.service');
    const auctionStateService = inject(AuctionStateService);
    auctionStateService.loadAllData(auctionId);

    return true;

  } catch (err) {
    console.error('[auctionWorkspaceGuard] Unexpected error:', err);
    router.navigate(['/home']);
    return false;
  }
};
