<?php

declare(strict_types=1);

namespace Modules\SiteEditor\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Route;

/**
 * Registers the SiteEditor module's routes.
 *
 * Two files, mirroring the two central files the routes came out of:
 * `routes/admin.php` (the per-user dashboards and the `/admin/site-editor`
 * SPA entry point) and `routes/web.php` (the CORS-enabled visual-editor asset
 * route). The generated `routes/api.php` was deleted along with
 * `mapApiRoutes()` — the module exposes no JSON API of its own.
 *
 * Both groups have to name the `web` middleware group explicitly. The admin
 * routes used to inherit it because `routes/web.php` `require`s
 * `routes/admin.php`, and the asset route inherited it from
 * `withRouting(web: ...)` in `bootstrap/app.php`. Mapping either file from a
 * module provider bypasses both, and without the explicit group the routes
 * would silently lose sessions, CSRF and the Inertia middleware
 * (plans/14-modular-laravel-setup.md §3.3) — which for the dashboard routes
 * means every Inertia render and every redirect-back POST.
 *
 * Reapplying the groups verbatim is the whole point: route names are a hard
 * invariant of the modular migration (§3.3), and
 * `tests/Feature/ModularSetupTest.php` fails the build if a baseline name
 * stops resolving. The `role:admin` gate that wrapped `admin.site-editor` in
 * the central file stays inside `routes/admin.php`, where it is legible next
 * to the one route it guards.
 *
 * Registration order is not load-bearing for either file. Module routes land
 * after everything in the central `routes/web.php`, including the `/{path}`
 * public-page catch-all whose `.+` pattern matches slashes — but
 * `admin($|/)` and `visual-editor($|/)` are both already alternatives in that
 * route's negative-lookahead constraint, so neither of this module's URIs can
 * be swallowed by it. Likewise `visual-editor.asset` yields
 * `/visual-editor/site/...` to the package's own SPA route through its
 * `^(?!site($|/))` constraint rather than through ordering.
 * `SiteEditorRoutesTest` pins both by matching real requests.
 */
class RouteServiceProvider extends ServiceProvider
{
    protected string $name = 'SiteEditor';

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
