<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Auth\Http\Controllers\AuthenticatedSessionController;
use Modules\Auth\Http\Controllers\ConfirmablePasswordController;
use Modules\Auth\Http\Controllers\EmailVerificationNotificationController;
use Modules\Auth\Http\Controllers\EmailVerificationPromptController;
use Modules\Auth\Http\Controllers\NewPasswordController;
use Modules\Auth\Http\Controllers\PasswordResetLinkController;
use Modules\Auth\Http\Controllers\RegisteredUserController;
use Modules\Auth\Http\Controllers\TwoFactorChallengeController;
use Modules\Auth\Http\Controllers\VerifyEmailController;

/*
|--------------------------------------------------------------------------
| Auth Web Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Auth\Providers\RouteServiceProvider`, which wraps this
| file in the `web` middleware group. That group used to be implicit — this
| file was `require`d from `routes/web.php`, which `bootstrap/app.php`
| registers via `withRouting(web: ...)` — so it has to be reapplied
| explicitly now that the module maps the file itself. Names and URIs are
| unchanged from the central `routes/auth.php` these were extracted from;
| route names are a hard invariant (plans/14-modular-laravel-setup.md §3.3).
|
| These are the first module routes Keystone owns that are NOT under the
| `admin/` prefix, which makes the `/{path}` catch-all in `routes/web.php`
| relevant for the first time: core routes register before module routes, so
| every GET URI here has to be listed in that route's path constraint or the
| public page controller answers `/login` instead of this file. See the
| comment on the constraint itself.
|
*/

Route::middleware('guest')->group(function (): void {
    Route::get('register', [RegisteredUserController::class, 'create'])->name('register');
    Route::post('register', [RegisteredUserController::class, 'store']);

    Route::get('login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('login', [AuthenticatedSessionController::class, 'store']);

    Route::get('forgot-password', [PasswordResetLinkController::class, 'create'])->name('password.request');
    Route::post('forgot-password', [PasswordResetLinkController::class, 'store'])->name('password.email');

    Route::get('reset-password/{token}', [NewPasswordController::class, 'create'])->name('password.reset');
    Route::post('reset-password', [NewPasswordController::class, 'store'])->name('password.store');
});

Route::middleware('auth')->group(function (): void {
    Route::get('verify-email', EmailVerificationPromptController::class)->name('verification.notice');

    Route::get('verify-email/{id}/{hash}', VerifyEmailController::class)
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');

    Route::post('email/verification-notification', [EmailVerificationNotificationController::class, 'store'])
        ->middleware('throttle:6,1')
        ->name('verification.send');

    Route::get('confirm-password', [ConfirmablePasswordController::class, 'show'])->name('password.confirm');
    Route::post('confirm-password', [ConfirmablePasswordController::class, 'store']);

    // Post-password 2FA challenge. Kept outside the 2FA-gated admin groups so
    // it remains reachable while a user is authenticated but not yet verified;
    // the route name matches `artisanpack.security-auth.routes.verify`.
    Route::get('two-factor-challenge', [TwoFactorChallengeController::class, 'create'])->name('two-factor.challenge');
    Route::post('two-factor-challenge', [TwoFactorChallengeController::class, 'store'])->name('two-factor.challenge.store');

    Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');

    // GET-side logout endpoint for the visual-editor `artisanpack/loginout`
    // block (#522). The block emits a plain `<a>`, but Breeze's logout is
    // POST + CSRF — bridging them via a `signed` GET route keeps the
    // anchor click-through working without the package's auth flow having
    // to grow form-aware rendering. The signature ties the link to the
    // current request URL so it can't be replayed to log out unrelated
    // sessions.
    Route::get('logout-link', [AuthenticatedSessionController::class, 'destroyViaLink'])
        ->middleware('signed')
        ->name('loginout.logout-link');
});
