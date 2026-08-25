<?php

declare(strict_types=1);

namespace Modules\Forms\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Route;

/**
 * Registers the Forms module's routes.
 *
 * The module owns both an admin surface (`admin.forms.*`) and one public route
 * (`public.forms.show`), so `routes/admin.php` and `routes/web.php` are both
 * mapped; the generated `routes/api.php` was deleted along with
 * `mapApiRoutes()`, since the forms package registers its own `/api/v1/forms/*`
 * endpoints.
 *
 * Both groups have to name the `web` middleware group explicitly. The admin
 * routes used to inherit it because `routes/web.php` `require`s
 * `routes/admin.php`, and the public route inherited it from
 * `withRouting(web: ...)` in `bootstrap/app.php`. Mapping either file from a
 * module provider bypasses both, and without the explicit group the routes
 * would silently lose sessions, CSRF and the Inertia middleware
 * (plans/14-modular-laravel-setup.md §3.3). That matters on the public route as
 * much as the admin ones: the page mounts the forms package's
 * `<FormRenderer />`, which POSTs to the package's `/api/v1/forms/*` endpoints
 * and needs the CSRF cookie the `web` stack sets.
 *
 * Reapplying the groups verbatim is the whole point: route names are a hard
 * invariant of the modular migration (§3.3), and
 * `tests/Feature/ModularSetupTest.php` fails the build if a baseline name stops
 * resolving. Per-route `feature:` and `site.access` gating stays inside the
 * route files, where it is legible next to the routes it guards.
 *
 * Registering the public route is not on its own enough to serve it. Module
 * routes register *after* everything in the central `routes/web.php`,
 * including the `/{path}` public-page catch-all whose `.+` pattern matches
 * slashes — so `forms/{form}` is kept off that catch-all by the `forms($|/)`
 * alternative already present in its constraint, not by ordering. That
 * alternative predates this extraction and needs no change; `FormsRoutesTest`
 * pins it by matching an actual request rather than trusting `route:list`.
 */
class RouteServiceProvider extends ServiceProvider
{
    protected string $name = 'Forms';

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
