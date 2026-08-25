<?php

declare(strict_types=1);

namespace Modules\Performance\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Route;

/**
 * Registers the Performance module's routes.
 *
 * The module owns admin surfaces only, so it maps a single
 * `routes/admin.php` and reapplies — verbatim — the outer group the
 * central `routes/admin.php` used to wrap these routes in: the `web`
 * middleware group (previously inherited, because `routes/web.php`
 * `require`s the admin file), the shared auth/2FA stack, the `admin`
 * URI prefix and the `admin.` name prefix.
 *
 * That reapplication is the whole point: route names are a hard
 * invariant of the modular migration (plans/14-modular-laravel-setup.md
 * §3.3), and `tests/Feature/ModularSetupTest.php` fails the build if a
 * baseline name stops resolving. Per-route role gating stays inside
 * `routes/admin.php`, where it is legible next to the routes it guards.
 */
class RouteServiceProvider extends ServiceProvider
{
    protected string $name = 'Performance';

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
     * Middleware order matters — it is reproduced exactly as the central
     * admin group declared it, so `php artisan route:list` reports the
     * same stack it did before the extraction.
     */
    protected function mapAdminRoutes(): void
    {
        Route::middleware(['web', 'auth', 'verified', 'two-factor', 'two-factor.enroll'])
            ->prefix('admin')
            ->name('admin.')
            ->group(module_path($this->name, '/routes/admin.php'));
    }
}
