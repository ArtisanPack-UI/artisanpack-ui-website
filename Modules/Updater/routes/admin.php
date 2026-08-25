<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Updater\Http\Controllers\Settings\UpdatesController as SettingsUpdatesController;

/*
|--------------------------------------------------------------------------
| Updater Admin Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Updater\Providers\RouteServiceProvider`, which wraps
| this file in the shared admin group (`web` + auth/2FA stack, `admin`
| prefix, `admin.` name prefix). Names and URIs are unchanged from the
| central `routes/admin.php` these were extracted from — see
| plans/14-modular-laravel-setup.md §3.3.
|
*/

// #21 — Settings > System > Updates. Surfaces the cms-framework
// Updates module (release feed, "Update now" button) inside the
// Keystone admin shell. The `permission:updater.run` slug is
// seeded admin-only by KeystonePermissionsSeeder; the `role:admin`
// group is the belt to that suspenders — it wrapped these routes in
// the central file and is reapplied here so the middleware stack
// `route:list` reports is byte-identical.
Route::middleware(['role:admin', 'permission:updater.run'])
    ->prefix('settings')
    ->name('settings.')
    ->group(function (): void {
        Route::get('updates', [SettingsUpdatesController::class, 'show'])->name('updates');
        Route::post('updates', [SettingsUpdatesController::class, 'update'])->name('updates.run');
        Route::post('updates/check', [SettingsUpdatesController::class, 'check'])
            ->middleware('throttle:6,1')
            ->name('updates.check');
    });
