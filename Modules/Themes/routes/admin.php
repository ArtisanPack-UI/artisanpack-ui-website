<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Themes\Http\Controllers\BusinessInfoController;
use Modules\Themes\Http\Controllers\ThemeController;

/*
|--------------------------------------------------------------------------
| Themes Admin Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Themes\Providers\RouteServiceProvider`, which wraps this
| file in the shared admin group (`web` + auth/2FA stack, `admin` prefix,
| `admin.` name prefix). Names and URIs are unchanged from the central
| `routes/admin.php` these were extracted from — see
| plans/14-modular-laravel-setup.md §3.3.
|
| The `role:admin` group wrapped these routes in the central file — shared there
| with the plugins and content-model groups — and is reapplied here so the
| middleware stack `route:list` reports is identical.
|
| Only the `site-design.` *prefixed* group moved. The bare `admin.site-design`
| route stays central: it renders the `admin/SiteDesign` shell placeholder from
| `KeystoneShellController`, which §3.5 keeps in core until commerce is real.
|
*/

Route::middleware('role:admin')->group(function (): void {
    // #25 — Theme upload UI. Admin-only per the install-gating decision in
    // plans/08-themes-site-editor-arc.md: the cms-framework Themes module
    // exposes the capability, Keystone owns the gate.
    Route::prefix('site-design')->name('site-design.')->group(function (): void {
        Route::get('themes', [ThemeController::class, 'index'])->name('themes.index');
        Route::post('themes', [ThemeController::class, 'store'])->name('themes.store');
        Route::post('themes/{slug}/activate', [ThemeController::class, 'activate'])->name('themes.activate');
        Route::delete('themes/{slug}', [ThemeController::class, 'destroy'])->name('themes.destroy');

        // #19 — Global Content (Business Info) panel. Edits the `global.*`
        // settings registered in SettingsServiceProvider so reads via
        // `apGetSetting('global.<key>')` work anywhere (controllers, Blade,
        // Inertia props).
        Route::get('business-info', [BusinessInfoController::class, 'edit'])->name('business-info.edit');
        Route::patch('business-info', [BusinessInfoController::class, 'update'])->name('business-info.update');
    });
});
