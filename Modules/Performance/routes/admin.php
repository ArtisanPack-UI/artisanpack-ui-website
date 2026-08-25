<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Performance\Http\Controllers\PerformanceAdminController;
use Modules\Performance\Http\Controllers\Settings\PerformanceController as SettingsPerformanceController;

/*
|--------------------------------------------------------------------------
| Performance Admin Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Performance\Providers\RouteServiceProvider`, which
| wraps this file in the shared admin group (`web` + auth/2FA stack,
| `admin` prefix, `admin.` name prefix). Names and URIs are unchanged
| from the central `routes/admin.php` these were extracted from — see
| plans/14-modular-laravel-setup.md §3.3.
|
*/

// #98.4 — Top-level Performance admin nav. Read-only surfaces
// (RUM dashboard, slow query log, index suggestions, cache
// management) that render around the vendor perf package's
// JSON API. Gated behind admin/site_owner — the RUM dashboard
// exposes per-page traffic and the slow query log exposes
// query text that leaks table/column names, so editors don't
// need it in their day-to-day view.
Route::middleware('role:admin,site_owner')
    ->prefix('performance')
    ->name('performance.')
    ->group(function (): void {
        Route::get('/', [PerformanceAdminController::class, 'overview'])->name('overview');
        Route::get('slow-queries', [PerformanceAdminController::class, 'slowQueries'])->name('slow-queries');
        Route::get('index-suggestions', [PerformanceAdminController::class, 'indexSuggestions'])->name('index-suggestions');
        Route::get('cache', [PerformanceAdminController::class, 'cacheManagement'])->name('cache');
    });

// #98.3 — Settings > Performance. Same pattern as Settings > Privacy:
// the panel is rendered inline inside `admin/Settings` (see
// `KeystoneShellController::settings()`, which hydrates it from
// `SettingsPerformanceController::payload()`); this is the mutation
// endpoint. Admin-only because flipping page cache or fragment cache
// off silently in production can spike origin load.
Route::middleware('role:admin')
    ->prefix('settings')
    ->name('settings.')
    ->group(function (): void {
        Route::post('performance', [SettingsPerformanceController::class, 'update'])->name('performance.update');
    });
