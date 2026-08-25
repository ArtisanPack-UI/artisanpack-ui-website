<?php

declare(strict_types=1);

namespace Modules\Users\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Route;

/**
 * Registers the Users module's routes.
 *
 * The module owns two admin surfaces and no public or API one, so the
 * generated `routes/{web,api}.php` were deleted along with their mapping
 * methods. Both files below reapply verbatim the outer group the central
 * `routes/admin.php` wrapped these routes in, including the `web`
 * middleware group — previously inherited, because `routes/web.php`
 * `require`s the admin file, and silently dropped (sessions, CSRF,
 * Inertia) when a module provider maps a file without naming it.
 *
 * That reapplication is the whole point: route names are a hard invariant
 * of the modular migration (plans/14-modular-laravel-setup.md §3.3), and
 * `tests/Feature/ModularSetupTest.php` fails the build if a baseline name
 * stops resolving. Per-route role gating stays inside the route files,
 * where it is legible next to the routes it guards.
 *
 * The split into two files mirrors the two top-level groups the central
 * file declared. Personal account settings skip `verified` /
 * `two-factor` / `two-factor.enroll` so an unverified user can still
 * reach their profile to (re)send the verification email, which is why
 * they cannot ride along in the shared admin group.
 */
class RouteServiceProvider extends ServiceProvider
{
    protected string $name = 'Users';

    /**
     * Define the routes for the module.
     */
    public function map(): void
    {
        $this->mapAdminRoutes();
        $this->mapAccountRoutes();
    }

    /**
     * Define the account-settings routes for the module.
     *
     * `auth` alone, matching the second admin group in the central file —
     * see `routes/account.php` for why the `verified` stack is absent.
     */
    protected function mapAccountRoutes(): void
    {
        Route::middleware(['web', 'auth'])
            ->prefix('admin')
            ->name('admin.')
            ->group(module_path($this->name, '/routes/account.php'));
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
