<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Privacy\Http\Controllers\PrivacyAdminController;
use Modules\Privacy\Http\Controllers\Settings\PrivacyController as SettingsPrivacyController;

/*
|--------------------------------------------------------------------------
| Privacy Admin Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Privacy\Providers\RouteServiceProvider`, which wraps
| this file in the shared admin group (`web` + auth/2FA stack, `admin`
| prefix, `admin.` name prefix). Names and URIs are unchanged from the
| central `routes/admin.php` these were extracted from — see
| plans/14-modular-laravel-setup.md §3.3.
|
*/

// #96.3 — Top-level Privacy admin nav. Gated behind admin only:
// the Consent Manager and DSR inbox expose subject data that
// should not be visible to editors, and Breach Manager can
// trigger authority notifications.
Route::middleware('role:admin,site_owner')
    ->prefix('privacy')
    ->name('privacy.')
    ->group(function (): void {
        Route::get('/', [PrivacyAdminController::class, 'consents'])->name('consents');
        Route::get('data-requests', [PrivacyAdminController::class, 'dataRequests'])->name('data-requests');
        Route::get('breaches', [PrivacyAdminController::class, 'breaches'])->name('breaches');
        Route::get('reports', [PrivacyAdminController::class, 'reports'])->name('reports');
    });

// #96.2 — Settings > Privacy. The panel itself is rendered
// inline inside the main `admin/Settings` shell (see
// KeystoneShellController::settings()); these routes are the
// mutation endpoints the panel POSTs/PATCHes/DELETEs against.
// Admin-only per the same policy as the top-level Privacy nav:
// exposing regulation toggles, DPO contact, and
// consent-category management would let editors silently
// disable compliance guardrails.
Route::middleware('role:admin')
    ->prefix('settings')
    ->name('settings.')
    ->group(function (): void {
        Route::post('privacy', [SettingsPrivacyController::class, 'update'])->name('privacy.update');
        Route::post('privacy/categories', [SettingsPrivacyController::class, 'storeCategory'])->name('privacy.categories.store');
        Route::patch('privacy/categories/{category}', [SettingsPrivacyController::class, 'updateCategory'])->name('privacy.categories.update');
        Route::delete('privacy/categories/{category}', [SettingsPrivacyController::class, 'destroyCategory'])->name('privacy.categories.destroy');
    });
