<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Seo\Http\Controllers\SeoRedirectController;

/*
|--------------------------------------------------------------------------
| Seo Admin Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Seo\Providers\RouteServiceProvider`, which wraps this
| file in the shared admin group (`web` + auth/2FA stack, `admin` prefix,
| `admin.` name prefix). Names and URIs are unchanged from the central
| `routes/admin.php` these were extracted from — see
| plans/14-modular-laravel-setup.md §3.3.
|
*/

// #18 — SEO redirects admin. Read/write is restricted to roles
// with editorial control over the site; the `redirects` table is
// read on every public web request via the HandleRedirects
// middleware shipped by the SEO package.
Route::middleware('role:admin,site_owner,editor')
    ->prefix('seo')
    ->name('seo.')
    ->group(function (): void {
        Route::get('redirects', [SeoRedirectController::class, 'index'])->name('redirects.index');
        Route::post('redirects', [SeoRedirectController::class, 'store'])->name('redirects.store');
        Route::put('redirects/{redirect}', [SeoRedirectController::class, 'update'])->name('redirects.update');
        Route::delete('redirects/{redirect}', [SeoRedirectController::class, 'destroy'])->name('redirects.destroy');
    });
