<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Media\Http\Controllers\MediaController;

/*
|--------------------------------------------------------------------------
| Media Admin Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Media\Providers\RouteServiceProvider`, which wraps this
| file in the shared admin group (`web` + auth/2FA stack, `admin` prefix,
| `admin.` name prefix). The name and URI are unchanged from the central
| `routes/admin.php` this was extracted from — see
| plans/14-modular-laravel-setup.md §3.3.
|
| The role gate below is the one that wrapped this route in the central file,
| reapplied here so the middleware stack `route:list` reports is identical.
|
| This is the module's only route. The media library's own CRUD lives on
| artisanpack-ui/media-library's `/api/media/*` routes, which the package
| registers itself and Keystone never redeclares.
|
*/

Route::middleware('role:admin,site_owner,editor')->group(function (): void {
    Route::get('media', [MediaController::class, 'index'])->name('media.index');
});
