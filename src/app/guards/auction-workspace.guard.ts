import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { AuctionStateService } from '../services/auction-state.service';

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
 * This keeps the child components (overview, teams, control, …) clean —
 * they can assume the auction is valid and data is pre-loaded.
 */
export const auctionWorkspaceGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot
) => {
  const supabaseService = inject(SupabaseService);
  const auctionStateService = inject(AuctionStateService);
  const router = inject(Router);

  // ── 1. Ensure user is authenticated ───────────────────────────────────────
  const user = await supabaseService.waitForAuthInitialization();
  if (!user) {
    router.navigate(['/login'], { queryParams: { returnUrl: route.url.join('/') } });
    return false;
  }

  // ── 2. Read route param ────────────────────────────────────────────────────
  const auctionId = route.paramMap.get('id');
  if (!auctionId) {
    router.navigate(['/home']);
    return false;
  }

  // ── 3. Fetch auction and validate ownership ────────────────────────────────
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

    // ── 4. Ownership check (owner OR super_admin) ──────────────────────────
    const isOwner = auction.owner_id === user.id;
    const isAdmin = supabaseService.isAdminValue;

    if (!isOwner && !isAdmin) {
      console.warn(`[auctionWorkspaceGuard] User does not own auction "${auctionId}".`);
      router.navigate(['/home']);
      return false;
    }

    // ── 5. Pre-load auction data into AuctionStateService ─────────────────
    // Non-blocking: kick off the load but don't await it so the page renders
    // immediately while data arrives. AuctionStateService exposes a loading
    // signal that child components can use to show skeletons.
    auctionStateService.loadAllData(auctionId);

    return true;

  } catch (err) {
    console.error('[auctionWorkspaceGuard] Unexpected error:', err);
    router.navigate(['/home']);
    return false;
  }
};
