<?php

declare(strict_types=1);

namespace Modules\Themes\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Route;

/**
 * Registers the Themes module's routes.
 *
 * The module owns one admin group and one public route, so `routes/admin.php`
 * and `routes/web.php` are both mapped; the generated `routes/api.php` was
 * deleted along with `mapApiRoutes()`, since cms-framework's Themes module
 * exposes no Keystone-declared API surface.
 *
 * Both groups have to name the `web` middleware group explicitly. The admin
 * routes used to inherit it because `routes/web.php` `require`s
 * `routes/admin.php`, and the asset route inherited it from
 * `withRouting(web: ...)` in `bootstrap/app.php`. Mapping either file from a
 * module provider bypasses both, and without the explicit group the routes
 * would silently lose sessions, CSRF and the Inertia middleware
 * (plans/14-modular-laravel-setup.md §3.3) — which on the admin screens means
 * no Inertia response gets built at all.
 *
 * `themes.asset` is the module's one public route, and the reason this module
 * can move its public route where Pages could not is that `themes($|/)` is
 * already an alternative in the `/{path}` catch-all's negative-lookahead
 * constraint in the central `routes/web.php`. Module routes register *after*
 * everything in that file and `{path}`'s `.+` matches slashes, so that
 * pre-existing alternative — not ordering — is what keeps `/themes/...`
 * reachable. It needed no change; `ThemesRoutesTest` pins it by matching an
 * actual request rather than trusting `route:list`.
 *
 * The bare `admin.site-design` route is NOT here. It renders the
 * `admin/SiteDesign` shell placeholder from `Admin\KeystoneShellController`,
 * which stays central per §3.5 until commerce becomes real — only the
 * `site-design.` *prefixed* group moved.
 */
class RouteServiceProvider extends ServiceProvider
{
    protected string $name = 'Themes';

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
