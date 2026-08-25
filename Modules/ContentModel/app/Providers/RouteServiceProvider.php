<?php

declare(strict_types=1);

namespace Modules\ContentModel\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Route;

/**
 * Registers the ContentModel module's routes.
 *
 * The module owns two admin groups and no public or API surface, so the
 * generated `routes/{web,api}.php` were deleted along with their mapping
 * methods — the same call Pages made.
 *
 * The admin group below reapplies verbatim the outer group the central
 * `routes/admin.php` wrapped both content groups in, including the `web`
 * middleware group — previously inherited, because `routes/web.php` `require`s
 * the admin file, and silently dropped (sessions, CSRF, Inertia) when a module
 * provider maps a file without naming it. Reapplying it verbatim is the whole
 * point: route names are a hard invariant of the modular migration
 * (plans/14-modular-laravel-setup.md §3.3), and
 * `tests/Feature/ModularSetupTest.php` fails the build if a baseline name stops
 * resolving. The two different `role:` gates the groups carried stay inside the
 * route file, where they are legible next to the routes they guard.
 *
 * Registering later than the central admin file is safe here in a way worth
 * stating, because the `admin.content.*` routes match on a `{contentType}`
 * wildcard. They sit under the literal `content/` prefix, so they can only ever
 * match `admin/content/...` — never `admin/posts/...` or `admin/pages/...`,
 * whichever file declares them. The guard against a content type named `post`
 * or `page` shadowing the bespoke Blog/Pages screens was never route ordering;
 * it is the explicit rejection inside `ContentTypeContentController::resolve()`,
 * which the move leaves untouched.
 */
class RouteServiceProvider extends ServiceProvider
{
    protected string $name = 'ContentModel';

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
