<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Users\Http\Controllers\EditorPreferenceController;
use Modules\Users\Http\Controllers\PermissionController;
use Modules\Users\Http\Controllers\RoleController;
use Modules\Users\Http\Controllers\UserController;

/*
|--------------------------------------------------------------------------
| Users Admin Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Users\Providers\RouteServiceProvider`, which wraps this
| file in the shared admin group (`web` + auth/2FA stack, `admin` prefix,
| `admin.` name prefix). Names and URIs are unchanged from the central
| `routes/admin.php` these were extracted from — see
| plans/14-modular-laravel-setup.md §3.3.
|
| The three role gates below are the ones that wrapped these routes in the
| central file, reapplied here so the middleware stack `route:list` reports
| is byte-identical. Personal account settings skip `verified` and so live
| in `routes/account.php` instead.
|
*/

Route::middleware('role:admin,site_owner,editor')->group(function (): void {
    // #189 — Screen Options panel visibility. Lives beside the
    // editor screens (rather than under `posts`/`pages`) because
    // preferences are per-user and per-post-type, not per-record.
    Route::put('editor-preferences/{postType}', [EditorPreferenceController::class, 'update'])
        ->name('editor-preferences.update');
    // #239 — editor chrome view mode (normal / full-width / distraction-free).
    // A sibling of `update` rather than a key on it so the mode write never
    // has to carry (or clobber) the panel layout. See the controller.
    Route::put('editor-preferences/{postType}/view-mode', [EditorPreferenceController::class, 'updateViewMode'])
        ->name('editor-preferences.view-mode');
    Route::delete('editor-preferences/{postType}', [EditorPreferenceController::class, 'destroy'])
        ->name('editor-preferences.destroy');
});

Route::middleware('role:admin,site_owner')->group(function (): void {
    Route::resource('users', UserController::class)->except(['show']);
});

Route::middleware('role:admin')->group(function (): void {
    Route::resource('roles', RoleController::class)->except(['show']);
    Route::get('permissions', [PermissionController::class, 'index'])->name('permissions.index');
});
