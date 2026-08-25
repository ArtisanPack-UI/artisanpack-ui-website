<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Pages\Http\Controllers\PageController;

/*
|--------------------------------------------------------------------------
| Pages Admin Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Pages\Providers\RouteServiceProvider`, which wraps this
| file in the shared admin group (`web` + auth/2FA stack, `admin` prefix,
| `admin.` name prefix). Names and URIs are unchanged from the central
| `routes/admin.php` these were extracted from — see
| plans/14-modular-laravel-setup.md §3.3.
|
| The `role:admin,site_owner,editor` group wrapped these routes in the central
| file — where they shared it with the posts resource until #211 moved that into
| the Blog module — and is reapplied here so the middleware stack `route:list`
| reports is identical. Pages carry no `feature:` gate: the public site is pages,
| so there is no flag to turn them off behind.
|
| The module owns no public routes. `/` (`home`) and the `/{path}` catch-all
| (`public.show`) both point at this module's `PublicPageController` but stay in
| the central `routes/web.php` — the catch-all is the constraint that keeps every
| *other* module's public routes reachable (§3.3), so it cannot follow the
| controller into a module without inverting that relationship.
|
*/

Route::middleware('role:admin,site_owner,editor')->group(function (): void {
    Route::post('pages/{page}/duplicate', [PageController::class, 'duplicate'])->name('pages.duplicate');
    // #184 — Add New modal quick-create endpoint. Declared before
    // the resource so `pages/quick-create` isn't captured as a
    // `{page}` binding on the show/edit/update routes.
    Route::post('pages/quick-create', [PageController::class, 'quickCreate'])->name('pages.quick-create');
    // #185 — Live slug preview for the "auto-derive while draft"
    // slug field. Declared before the resource for the same
    // wildcard-collision reason as `quick-create`.
    //
    // Throttled: the client debounces at 500ms, so a human typing
    // stays far under 60/min, but the endpoint is unauthenticated-
    // adjacent enough (any logged-in editor) and cheap enough to
    // call in a loop that it needs a ceiling of its own.
    Route::post('pages/slug-preview', [PageController::class, 'slugPreview'])
        ->middleware('throttle:60,1')
        ->name('pages.slug-preview');
    Route::resource('pages', PageController::class)->except(['show', 'create']);
});
