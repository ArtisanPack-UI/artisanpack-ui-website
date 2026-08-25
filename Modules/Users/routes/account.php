<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Users\Http\Controllers\Settings\AppearanceController;
use Modules\Users\Http\Controllers\Settings\PasswordController;
use Modules\Users\Http\Controllers\Settings\ProfileController;
use Modules\Users\Http\Controllers\Settings\TwoFactorController;

/*
|--------------------------------------------------------------------------
| Users Account Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Users\Providers\RouteServiceProvider`, which wraps this
| file in `web` + `auth` only, under the `admin` prefix and `admin.` name
| prefix.
|
| A file of its own rather than a group inside `routes/admin.php`: personal
| account settings live under `/admin/*` alongside the rest of the admin
| shell but deliberately skip `verified`, so an unverified user can still
| reach their profile to (re)send the verification email. That was a second
| top-level group in the central `routes/admin.php`, and reproducing the
| middleware stack exactly — rather than subtracting `verified` from the
| shared group with `withoutMiddleware()` — is what keeps `route:list`
| byte-identical across the extraction.
|
*/

Route::get('profile', [ProfileController::class, 'edit'])->name('profile');
Route::patch('profile', [ProfileController::class, 'update'])->name('profile.update');
Route::delete('profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

// Account pages live beneath `/admin/profile/*` to group them under the
// user-profile section. Route names are kept flat (`admin.password`,
// `admin.appearance`, `admin.two-factor`) so existing references hold.
Route::prefix('profile')->group(function (): void {
    Route::get('password', [PasswordController::class, 'edit'])->name('password');
    Route::put('password', [PasswordController::class, 'update'])->name('password.update');

    Route::get('appearance', [AppearanceController::class, 'edit'])->name('appearance');

    Route::get('two-factor', [TwoFactorController::class, 'edit'])->name('two-factor');
    Route::post('two-factor', [TwoFactorController::class, 'store'])->name('two-factor.store');
    Route::delete('two-factor', [TwoFactorController::class, 'destroy'])->name('two-factor.destroy');
});
