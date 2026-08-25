<?php

declare(strict_types=1);

namespace Modules\Seo\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Route;

/**
 * Registers the Seo module's routes.
 *
 * The module owns one admin screen — the redirects table — and no public
 * or API surface: `/sitemap.xml`, `/robots.txt` and the `/api/seo/*`
 * endpoints are registered by `artisanpack-ui/seo` itself, so the
 * generated `routes/{web,api}.php` were deleted along with their mapping
 * methods.
 *
 * The group below reapplies verbatim the outer group the central
 * `routes/admin.php` used to wrap these routes in: the `web` middleware
 * group (previously inherited, because `routes/web.php` `require`s the
 * admin file), the shared auth/2FA stack, the `admin` URI prefix and the
 * `admin.` name prefix. That reapplication is the whole point — route
 * names are a hard invariant of the modular migration
 * (plans/14-modular-laravel-setup.md §3.3), and
 * `tests/Feature/ModularSetupTest.php` fails the build if a baseline name
 * stops resolving. The `role:` gate stays inside `routes/admin.php`, where
 * it is legible next to the routes it guards.
 */
class RouteServiceProvider extends ServiceProvider
{
    protected string $name = 'Seo';

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
