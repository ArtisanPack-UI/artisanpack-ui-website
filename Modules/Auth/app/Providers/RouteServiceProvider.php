<?php

declare(strict_types=1);

namespace Modules\Auth\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Route;

/**
 * Registers the Auth module's routes.
 *
 * The module owns the whole of the former central `routes/auth.php` — login,
 * registration, password reset/confirmation, email verification, the 2FA
 * challenge and logout — and no admin or API surface, so only
 * `routes/web.php` is mapped and the generated `routes/api.php` was deleted
 * along with `mapApiRoutes()`.
 *
 * The `web` middleware group is the only wrapper, and it is the one thing
 * that has to be stated rather than inherited: the file used to be `require`d
 * from `routes/web.php`, which `bootstrap/app.php` registers through
 * `withRouting(web: ...)`, so `web` arrived implicitly. Mapping the file from
 * a module provider bypasses that, and without the explicit group every route
 * here would silently lose sessions, CSRF and the Inertia middleware — the
 * failure mode plans/14-modular-laravel-setup.md §3.3 documents for admin
 * routes, which applies verbatim to public ones. No prefix and no name
 * prefix: these routes are top-level and their names (`login`, `register`,
 * `password.*`, `verification.*`, `two-factor.challenge*`, `logout`,
 * `loginout.logout-link`) are a hard invariant that `ModularSetupTest` pins.
 *
 * The per-route `guest` / `auth` / `signed` / `throttle` middleware stays
 * inside `routes/web.php`, next to the routes it guards.
 */
class RouteServiceProvider extends ServiceProvider
{
    protected string $name = 'Auth';

    /**
     * Define the routes for the module.
     */
    public function map(): void
    {
        $this->mapWebRoutes();
    }

    /**
     * Define the web routes for the module.
     */
    protected function mapWebRoutes(): void
    {
        Route::middleware('web')->group(module_path($this->name, '/routes/web.php'));
    }
}
