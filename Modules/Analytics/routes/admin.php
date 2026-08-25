<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Analytics\Http\Controllers\ReportsController;

/*
|--------------------------------------------------------------------------
| Analytics Admin Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Analytics\Providers\RouteServiceProvider`, which wraps
| this file in the shared admin group (`web` + auth/2FA stack, `admin`
| prefix, `admin.` name prefix). Names and URIs are unchanged from the
| central `routes/admin.php` these were extracted from — see
| plans/14-modular-laravel-setup.md §3.3.
|
*/

// The Reports screen is the only Keystone surface backed by
// `artisanpack-ui/analytics`, so `feature:analytics` gates it here
// exactly as it did centrally: with the flag off the route 404s rather
// than rendering an empty dashboard, and `AdminMenuBuilder` drops the
// nav item to match. No role gate — reports are readable by anyone who
// can reach the admin shell, which is what the central file declared.
Route::middleware('feature:analytics')->group(function (): void {
    Route::get('reports', [ReportsController::class, 'index'])->name('reports');
});
