<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Installer\Http\Controllers\InstallController;

/*
|--------------------------------------------------------------------------
| Installer Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Installer\Providers\RouteServiceProvider`, which wraps
| this file in the `web` middleware group the central `routes/web.php`
| supplied implicitly via `withRouting(web: ...)`. Names and URIs are
| unchanged from that file — see plans/14-modular-laravel-setup.md §3.3.
|
| One-time install wizard. Gated by `installed:guard` — pre-install requests
| need a valid `?token=` (+ optional IP allowlist) and the absence of the
| `.installed` flag; once installed, every request 404s so the surface
| stops existing entirely. See `plans/06-keystone-plan.md` §5.3.
|
| `install.show` is only reachable because the central catch-all's path
| constraint already excludes `install($|/)`: module routes register after
| `routes/web.php`, so ordering no longer protects it (§3.3).
| `InstallerRoutesTest` pins that through the router's own matcher.
|
*/

Route::middleware('installed:guard')->group(function (): void {
    Route::get('install', [InstallController::class, 'show'])->name('install.show');
    Route::post('install', [InstallController::class, 'store'])->name('install.store');
});
