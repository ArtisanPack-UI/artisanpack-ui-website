<?php

declare(strict_types=1);

namespace Modules\Installer\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Route;

/**
 * Registers the Installer module's routes.
 *
 * The module owns two top-level public routes and nothing under `/admin` — an
 * unauthenticated operator is the only person who can ever reach them — so
 * only `routes/web.php` is mapped; the generated `routes/api.php` was deleted
 * along with `mapApiRoutes()`.
 *
 * The group has to name the `web` middleware group explicitly. These routes
 * inherited it from `withRouting(web: ...)` in `bootstrap/app.php`; mapping the
 * file from a module provider bypasses that, and without the explicit group the
 * routes would silently lose sessions, CSRF and the Inertia middleware
 * (plans/14-modular-laravel-setup.md §3.3). Sessions in particular are load-
 * bearing here and not just for the Inertia response: `installed:guard` reads
 * the single-use `install.granted` grant off the session to authorize the
 * wizard's POST, so a session-less stack would 403 every submit.
 *
 * `installed:guard` itself stays inside the route file, where it is legible
 * next to the routes it guards, and is applied by the same `Route::middleware`
 * group the central file used — so `php artisan route:list` reports the same
 * stack, in the same order, that it did before the extraction.
 *
 * Registering the routes is not on its own enough to serve them. Module routes
 * register *after* everything in the central `routes/web.php`, including the
 * `/{path}` public-page catch-all whose `.+` pattern matches slashes — so
 * `GET /install` is kept off that catch-all by the `install($|/)` alternative
 * already present in its constraint, not by ordering. That alternative predates
 * this extraction and needs no change; `InstallerRoutesTest` pins it by
 * matching an actual request rather than trusting `route:list`. `POST /install`
 * needs no such cover: the catch-all only answers GET.
 */
class RouteServiceProvider extends ServiceProvider
{
    protected string $name = 'Installer';

    /**
     * Define the routes for the module.
     */
    public function map(): void
    {
        $this->mapWebRoutes();
    }

    /**
     * Define the public routes for the module.
     */
    protected function mapWebRoutes(): void
    {
        Route::middleware('web')->group(module_path($this->name, '/routes/web.php'));
    }
}
