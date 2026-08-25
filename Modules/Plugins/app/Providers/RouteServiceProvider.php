<?php

declare(strict_types=1);

namespace Modules\Plugins\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Route;

/**
 * Registers the Plugins module's routes.
 *
 * The module owns one admin group and nothing public, so only
 * `routes/admin.php` is mapped; the generated `routes/web.php` and
 * `routes/api.php` were deleted along with `mapWebRoutes()`/`mapApiRoutes()`.
 * The framework's `/api/v1/plugins` JSON API is the vendor package's own
 * surface — Keystone declares no API routes for plugins, and deliberately does
 * not route the admin screen through it (that path is `auth`-gated rather than
 * admin-gated).
 *
 * The group has to name the `web` middleware group explicitly. These routes
 * used to inherit it because `routes/web.php` `require`s `routes/admin.php`;
 * mapping the file from a module provider bypasses that, and without the
 * explicit group the routes would silently lose sessions, CSRF and the Inertia
 * middleware (plans/14-modular-laravel-setup.md §3.3) — which on an admin
 * screen means no Inertia response gets built at all.
 */
class RouteServiceProvider extends ServiceProvider
{
    protected string $name = 'Plugins';

    /**
     * Define the routes for the module.
     */
    public function map(): void
    {
        $this->mapAdminRoutes();
    }

    /**
     * Define the admin routes for the module.
     *
     * Middleware order matters — it is reproduced exactly as the central admin
     * group declared it, so `php artisan route:list` reports the same stack it
     * did before the extraction.
     */
    protected function mapAdminRoutes(): void
    {
        Route::middleware(['web', 'auth', 'verified', 'two-factor', 'two-factor.enroll'])
            ->prefix('admin')
            ->name('admin.')
            ->group(module_path($this->name, '/routes/admin.php'));
    }
}
