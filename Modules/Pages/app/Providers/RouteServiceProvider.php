<?php

declare(strict_types=1);

namespace Modules\Pages\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Route;

/**
 * Registers the Pages module's routes.
 *
 * The module owns one admin resource and no public or API routes, so the
 * generated `routes/{web,api}.php` were deleted along with their mapping
 * methods. That absence is the notable thing about this provider rather than an
 * omission: `PublicPageController` moved into the module, but the two routes
 * that point at it — `home` (`/`) and `public.show` (`/{path}`) — deliberately
 * stayed in the central `routes/web.php`.
 *
 * They stay because the catch-all is load-bearing for every *other* module.
 * Module routes register after everything in `routes/web.php`
 * (plans/14-modular-laravel-setup.md §3.3), and `{path}`'s `.+` pattern matches
 * slashes, so what keeps a public module route reachable is the catch-all's
 * negative-lookahead constraint, not ordering. Moving the catch-all into Pages
 * would put that shared constraint inside one module and register it *after*
 * the routes it is supposed to yield to — `blog`, `forms` and the eight auth
 * URIs would all start resolving through the page resolver instead.
 * `PagesRoutesTest` pins both halves: the central routes still resolve to the
 * moved controller, and the catch-all still loses to every reserved prefix.
 *
 * The admin group below reapplies verbatim the outer group the central
 * `routes/admin.php` wrapped the pages resource in, including the `web`
 * middleware group — previously inherited, because `routes/web.php` `require`s
 * the admin file, and silently dropped (sessions, CSRF, Inertia) when a module
 * provider maps a file without naming it. Reapplying it verbatim is the whole
 * point: route names are a hard invariant of the modular migration (§3.3), and
 * `tests/Feature/ModularSetupTest.php` fails the build if a baseline name stops
 * resolving. Per-route role gating and the slug-preview throttle stay inside
 * the route file, where they are legible next to the routes they guard.
 */
class RouteServiceProvider extends ServiceProvider
{
    protected string $name = 'Pages';

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
