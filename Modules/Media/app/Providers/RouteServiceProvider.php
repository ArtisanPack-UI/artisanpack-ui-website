<?php

declare(strict_types=1);

namespace Modules\Media\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Route;

/**
 * Registers the Media module's routes.
 *
 * The module owns one admin route and no public or API one, so the generated
 * `routes/{web,api}.php` were deleted along with their mapping methods. The
 * group below reapplies verbatim the outer group the central `routes/admin.php`
 * wrapped the media route in, including the `web` middleware group —
 * previously inherited, because `routes/web.php` `require`s the admin file, and
 * silently dropped (sessions, CSRF, Inertia) when a module provider maps a file
 * without naming it.
 *
 * `web` matters more here than a one-route module suggests: the page mounts the
 * media-library package's React component, which calls the package's
 * `/api/media/*` routes with the admin session cookie under Sanctum's stateful
 * guard. Losing the session/CSRF stack on the shell would leave the page
 * rendering and every request it makes unauthenticated.
 *
 * That reapplication is the whole point: route names are a hard invariant of
 * the modular migration (plans/14-modular-laravel-setup.md §3.3), and
 * `tests/Feature/ModularSetupTest.php` fails the build if a baseline name stops
 * resolving. Per-route role gating stays inside the route file, where it is
 * legible next to the route it guards.
 */
class RouteServiceProvider extends ServiceProvider
{
    protected string $name = 'Media';

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
