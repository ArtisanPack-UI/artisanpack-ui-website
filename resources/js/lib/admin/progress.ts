/**
 * Admin-scoped top-of-screen loading progress bar.
 *
 * This module is the sole driver of the shared `#nprogress` DOM element:
 * Inertia's built-in progress bar is disabled in `resources/js/app.tsx`
 * (`progress: false`) so both sources of "something is happening" — Inertia
 * navigations/form submissions AND admin-only non-Inertia fetches — flow
 * through a single ref-counted coordinator here. That prevents either source
 * from prematurely completing the bar while the other is still in flight,
 * which was possible when Inertia and this module each held their own
 * NProgress instance.
 *
 * The public API:
 *
 * - {@link startAdminProgress} / {@link finishAdminProgress} — manual API
 *   for admin-only, non-Inertia fetches (notifications / settings /
 *   notification-preferences REST clients).
 * - {@link acquireAdminMarker} / {@link releaseAdminMarker} — ref-counted
 *   `data-admin` body marker driven by mounted admin layouts. Combined with
 *   the destination-based `data-nav-target` marker below, the CSS backstop
 *   in `resources/css/app.css` scopes the bar to admin-effective pages
 *   (mounted layout OR in-flight admin destination).
 *
 * Behaviour NOT exported but installed at module load:
 *
 * - `router.on('start')` / `router.on('finish')` listeners drive the shared
 *   progress coordinator for progress-bearing Inertia visits. Prefetches,
 *   `async: true` visits, and any visit that explicitly opts out via
 *   `showProgress: false` are ignored so silent background requests don't
 *   flash the bar or leak `data-nav-target` past the visible navigation.
 *   Each tracked visit is stored in a WeakSet so a cancelled visit's
 *   `finish` event can't decrement the counter for a newer visit that
 *   replaced it.
 */

import NProgress from 'nprogress';
import { router } from '@inertiajs/react';
import type { PendingVisit } from '@inertiajs/core';

NProgress.configure({
    showSpinner: false,
    minimum: 0.08,
    trickleSpeed: 100,
});

function isAdminPath(): boolean {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
}

/**
 * Shared ref count of anything currently driving the bar — Inertia visits
 * plus manual admin fetches. `NProgress.start()` fires only on the 0→1
 * transition; `NProgress.done()` only when the count returns to zero. This
 * is the single coordinator the CodeRabbit review asked for: it makes it
 * impossible for a shorter-lived request (whichever kind) to cut off a
 * longer one that's still in flight.
 */
let activeProgressCount = 0;

function beginProgress(): void {
    activeProgressCount += 1;
    if (activeProgressCount === 1) {
        NProgress.start();
    }
}

function endProgress(): void {
    if (activeProgressCount === 0) {
        return;
    }
    activeProgressCount -= 1;
    if (activeProgressCount === 0) {
        NProgress.done();
    }
}

/**
 * Ref count of manual starts that actually matched an admin path at start
 * time. Distinct from {@link activeProgressCount} so a stray
 * `finishAdminProgress()` (start was skipped because the caller was on the
 * public site) can't push the shared counter negative. Only decrements
 * `activeProgressCount` when there's a matched increment on this counter.
 */
let activeManualCount = 0;

/**
 * Start the admin progress bar for a manually driven request. No-ops on the
 * public site so a stray call from shared code can't leak the bar outside
 * admin. Composes with {@link finishAdminProgress} through the shared
 * coordinator, so overlapping manual starts and concurrent Inertia visits
 * cooperate correctly.
 */
export function startAdminProgress(): void {
    if (!isAdminPath()) {
        return;
    }
    activeManualCount += 1;
    beginProgress();
}

/**
 * Finish the admin progress bar for a manually driven request. Only decrements
 * when there was a matching {@link startAdminProgress}, so unmatched calls
 * are safe no-ops. Because the actual `NProgress.done()` is gated on the
 * shared coordinator, this cannot prematurely clear an Inertia navigation
 * that is still in flight — it will simply drop the manual reference count
 * and leave the bar running until Inertia finishes too.
 */
export function finishAdminProgress(): void {
    if (activeManualCount === 0) {
        return;
    }
    activeManualCount -= 1;
    endProgress();
}

/**
 * A visit is "progress-bearing" iff it should paint the bar. Inertia fires
 * `start` / `finish` for prefetches and async visits as well, and callers
 * can opt any visit out via `showProgress: false`; those should stay silent
 * so they don't flash the bar on background work or leak `data-nav-target`
 * past a visible navigation.
 */
function isProgressBearingVisit(visit: PendingVisit): boolean {
    if (visit.prefetch) {
        return false;
    }
    if (visit.async) {
        return false;
    }
    if (visit.showProgress === false) {
        return false;
    }
    return true;
}

/**
 * WeakSet of Inertia visits we've begun tracking. Keying on the visit object
 * itself (identity, not equality) means a cancelled visit's later `finish`
 * event decrements the counter for THAT visit and never for a newer one
 * that replaced it — which would otherwise happen if we naively decremented
 * on every `finish` regardless of source.
 */
const trackedVisits = new WeakSet<PendingVisit>();

/**
 * Count of tracked visits currently in flight, used only to decide when to
 * clear `data-nav-target`. Kept in parallel with `trackedVisits` because
 * WeakSet has no observable size.
 */
let pendingProgressVisitCount = 0;

router.on('start', (event) => {
    const visit = event.detail.visit;
    if (!isProgressBearingVisit(visit)) {
        return;
    }
    trackedVisits.add(visit);
    pendingProgressVisitCount += 1;
    beginProgress();
    if (typeof document === 'undefined') {
        return;
    }
    const destination = visit.url.pathname.startsWith('/admin') ? 'admin' : 'public';
    document.body.dataset.navTarget = destination;
});

router.on('finish', (event) => {
    const visit = event.detail.visit;
    if (!trackedVisits.has(visit)) {
        return;
    }
    trackedVisits.delete(visit);
    pendingProgressVisitCount = Math.max(0, pendingProgressVisitCount - 1);
    endProgress();
    if (pendingProgressVisitCount === 0 && typeof document !== 'undefined') {
        delete document.body.dataset.navTarget;
    }
});

/**
 * Ref-count of currently mounted admin layouts. Multiple admin layouts can
 * be nested (e.g. `SettingsLayout` wraps `KeystoneAdminLayout`), so a naive
 * set-on-mount / delete-on-unmount would remove `data-admin` the moment the
 * inner layout unmounted even though the outer is still up. The counter
 * lets every admin layout call {@link acquireAdminMarker} on mount and
 * {@link releaseAdminMarker} on unmount without stepping on siblings.
 */
let adminMarkerRefCount = 0;

/** Mark the body as being inside an admin layout. */
export function acquireAdminMarker(): void {
    if (typeof document === 'undefined') {
        return;
    }
    adminMarkerRefCount += 1;
    document.body.dataset.admin = 'true';
}

/** Release one admin-layout hold on the body marker. */
export function releaseAdminMarker(): void {
    if (typeof document === 'undefined') {
        return;
    }
    adminMarkerRefCount = Math.max(0, adminMarkerRefCount - 1);
    if (adminMarkerRefCount === 0) {
        delete document.body.dataset.admin;
    }
}
