<?php

declare(strict_types=1);

namespace Modules\Blog\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Route;

/**
 * Registers the Blog module's routes.
 *
 * The module owns an admin surface (`admin.posts.*`, plus both taxonomies) and
 * three public routes (`blog.index`, `blog.show`, `comments.store`), so
 * `routes/admin.php` and `routes/web.php` are both mapped; the generated
 * `routes/api.php` was deleted along with `mapApiRoutes()`, since cms-framework
 * registers its own `/api/v1/comments` endpoint and Keystone never redeclares
 * it.
 *
 * Both groups have to name the `web` middleware group explicitly. The admin
 * routes used to inherit it because `routes/web.php` `require`s
 * `routes/admin.php`, and the public ones inherited it from
 * `withRouting(web: ...)` in `bootstrap/app.php`. Mapping either file from a
 * module provider bypasses both, and without the explicit group the routes
 * would silently lose sessions, CSRF and the Inertia middleware
 * (plans/14-modular-laravel-setup.md §3.3) — which on `comments.store` means
 * every guest submission 419s, and on the admin screens means no Inertia
 * response gets built at all.
 *
 * Reapplying the groups verbatim is the whole point: route names are a hard
 * invariant of the modular migration (§3.3), and
 * `tests/Feature/ModularSetupTest.php` fails the build if a baseline name stops
 * resolving. Per-route `role:`, `feature:`, `site.access` and `throttle:`
 * gating stays inside the route files, where it is legible next to the routes
 * it guards.
 *
 * Registering the public routes is not on its own enough to serve them. Module
 * routes register *after* everything in the central `routes/web.php`, including
 * the `/{path}` public-page catch-all whose `.+` pattern matches slashes — so
 * `blog` and `blog/{slug}` are kept off that catch-all by the `blog($|/)`
 * alternative already present in its constraint, not by ordering. That
 * alternative predates this extraction and needs no change; `BlogRoutesTest`
 * pins it by matching an actual request rather than trusting `route:list`.
 */
class RouteServiceProvider extends ServiceProvider
{
    protected string $name = 'Blog';

    /**
     * Define the routes for the module.
     */
    public function map(): void
    {
        $this->mapWebRoutes();
        $this->mapAdminRoutes();
    }

    /**
     * Define the public routes for the module.
     */
    protected function mapWebRoutes(): void
    {
        Route::middleware('web')->group(module_path($this->name, '/routes/web.php'));
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
