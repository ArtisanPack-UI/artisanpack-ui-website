<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Themes\Http\Controllers\ThemeAssetController;

/*
|--------------------------------------------------------------------------
| Themes Public Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Themes\Providers\RouteServiceProvider`, which wraps this
| file in the `web` middleware group — previously inherited from
| `withRouting(web: ...)` in `bootstrap/app.php` and silently dropped when a
| module provider maps a file without naming it. Name and URI are unchanged
| from the central `routes/web.php` this was extracted from (§3.3).
|
| Deliberately *not* gated by `site.access`, exactly as before: a
| password-protected site still has to serve its own stylesheet, or the
| site-password screen renders unstyled.
|
*/

// Theme static assets (stylesheet, images, fonts). Themes live outside
// `public/` so the controller validates the slug + path and serves a
// strict allowlist of extensions. See ThemeAssetController.
//
// Reachable despite registering after the central `/{path}` catch-all because
// that route's constraint already excludes `themes($|/)` — see the module's
// RouteServiceProvider docblock.
Route::get('/themes/{theme}/{path}', ThemeAssetController::class)
    ->where('path', '.+')
    ->name('themes.asset');
