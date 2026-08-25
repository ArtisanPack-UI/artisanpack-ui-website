<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Plugins\Http\Controllers\PluginController;

/*
|--------------------------------------------------------------------------
| Plugins Admin Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Plugins\Providers\RouteServiceProvider`, which wraps this
| file in the shared admin group (`web` + auth/2FA stack, `admin` prefix,
| `admin.` name prefix). Names and URIs are unchanged from the central
| `routes/admin.php` these were extracted from — see
| plans/14-modular-laravel-setup.md §3.3.
|
| The `role:admin` group wrapped these routes in the central file — shared there
| with the themes and content-model groups — and is reapplied here so the
| middleware stack `route:list` reports is identical.
|
*/

Route::middleware('role:admin')->group(function (): void {
    // #99 — Plugin management. Same install-gating logic as themes:
    // installing a plugin registers a service provider and runs
    // migrations, so admin-only. Calls the framework's
    // PluginManager/UpdateManager directly rather than the
    // /api/v1/plugins JSON API, which is only `auth`-gated.
    Route::prefix('system')->name('system.')->group(function (): void {
        Route::get('plugins', [PluginController::class, 'index'])->name('plugins.index');
        Route::post('plugins', [PluginController::class, 'store'])->name('plugins.store');
        // #109 — explicit refresh so the index render never blocks
        // on remote update-server HTTP. Declared before the
        // `{slug}` action routes so the literal path segment wins.
        // Rate-limited because the action synchronously fans out
        // an HTTP call per plugin (up to N × 10s per invocation):
        // an admin double-clicking with many plugins installed
        // shouldn't be able to pin PHP workers.
        Route::post('plugins/check-updates', [PluginController::class, 'checkUpdates'])
            ->middleware('throttle:3,1')
            ->name('plugins.check-updates');
        Route::post('plugins/{slug}/activate', [PluginController::class, 'activate'])->name('plugins.activate');
        Route::post('plugins/{slug}/deactivate', [PluginController::class, 'deactivate'])->name('plugins.deactivate');
        Route::post('plugins/{slug}/update', [PluginController::class, 'update'])->name('plugins.update');
        Route::delete('plugins/{slug}', [PluginController::class, 'destroy'])->name('plugins.destroy');
    });
});
