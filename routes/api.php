<?php

declare(strict_types=1);

use App\Http\Controllers\Admin\NotificationPreferenceController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Application API Routes
|--------------------------------------------------------------------------
|
| App-level JSON endpoints. Mounted under `/api/v1` via `withRouting()` in
| bootstrap/app.php so they share the same versioning prefix as the
| cms-framework module endpoints (notifications, settings, etc.).
|
| Sanctum SPA cookie auth is wired in by the `api` middleware group; routes
| here just need `auth:sanctum` to require an authenticated session.
|
*/

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('notification-preferences', [NotificationPreferenceController::class, 'apiIndex'])
        ->name('api.notification-preferences.index');
    Route::put('notification-preferences', [NotificationPreferenceController::class, 'update'])
        ->name('api.notification-preferences.update');
    Route::delete('notification-preferences', [NotificationPreferenceController::class, 'destroy'])
        ->name('api.notification-preferences.destroy');
});
