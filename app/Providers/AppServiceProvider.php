<?php

declare(strict_types=1);

namespace App\Providers;

use App\Support\EnvWriter;
use App\Support\HookAliases;
use App\Support\SiteBranding;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use Modules\ContentModel\Models\DynamicContentEditorModel;
use Modules\Users\Models\User;

/**
 * The application-wide provider, post-modularization (#218).
 *
 * Everything a single module owns now registers from that module's own
 * provider under `Modules/<Name>/app/Providers`. What is left here is the
 * set that has no single owner: it is either consumed by core plus more than
 * one module, or it is an app-wide policy that a module has a clause in
 * rather than a stake in. Anything new belongs here only if it clears that
 * bar — see `plans/14-modular-laravel-setup.md` §3.5.
 */
class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        /**
         * `.env` writer, shared by the Installer module's install flow and
         * the env-driven settings panels (Performance, Privacy). A singleton
         * so those callers and the tests that rebind it against a temp path
         * — rather than the real `.env` — see one instance.
         */
        $this->app->singleton(EnvWriter::class, fn ($app) => EnvWriter::fromApplication($app));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        /**
         * Keystone's hook-name aliases, registered before any subscriber gets
         * a chance to bind. The map is empty today; it exists so the first
         * hook rename has somewhere to keep the old name working.
         */
        HookAliases::register();

        /**
         * The app-wide admin bypass: an `admin` short-circuits every ability
         * except dynamic-content-type ones, which fall through to
         * DynamicContentEditorModelPolicy so its `show_in_admin=false` and
         * "still-registered" checks still run. The carve-out lives here
         * rather than in the ContentModel module because it is a clause of
         * this bypass, not a content-model registration — the matching
         * `Gate::policy()` binding is in ContentModelServiceProvider.
         */
        Gate::before(function (User $user, string $ability, array $arguments = []): ?bool {
            foreach ($arguments as $arg) {
                if ($arg instanceof DynamicContentEditorModel) {
                    return null;
                }
            }

            return $user->hasRole('admin') ? true : null;
        });

        if (function_exists('addFilter')) {
            /**
             * GET-side bridge for the visual editor's `artisanpack/loginout`
             * block, which emits a plain `<a>` pointed at the config-defined
             * `logout_route` — and Breeze's `logout` is POST + CSRF, so the
             * anchor would land on a 405. Swap the URL for a signed link to
             * `loginout.logout-link` (AuthenticatedSessionController::
             * destroyViaLink), preserving the resolver's own `redirect_to`
             * query param so the post-logout redirect stays on the
             * originating page. Central because it spans the visual editor
             * (SiteEditor) and the logout route (Auth).
             */
            addFilter(
                'ap.visualEditor.loginout.envelope',
                function (array $envelope): array {
                    if (true !== ($envelope['isUserLoggedIn'] ?? false)) {
                        return $envelope;
                    }

                    $params  = [];
                    $current = (string) ($envelope['url'] ?? '');
                    $query   = parse_url($current, PHP_URL_QUERY);

                    if (is_string($query) && '' !== $query) {
                        parse_str($query, $params);
                    }

                    $envelope['url'] = URL::signedRoute(
                        'loginout.logout-link',
                        $params,
                    );

                    return $envelope;
                },
            );
        }

        /**
         * Favicon for the Inertia root template, emitted from the configured
         * brand logo (`site.logo_id`) so the admin matches the public theme.
         * Central because `app.blade.php` is the root view for every module's
         * pages.
         */
        View::composer('app', function ($view): void {
            $view->with('siteIcon', SiteBranding::icon());
        });
    }
}
