<?php

declare(strict_types=1);

namespace App\Providers;

use App\Http\Requests\Media\MediaStoreRequest as KeystoneMediaStoreRequest;
use App\Models\DynamicContentEditorModel;
use App\Models\User;
use App\Policies\DynamicContentEditorModelPolicy;
use App\Services\Plugins\PluginUpdateUrlGuard;
use App\SiteEditor\KeystoneResourceResolver;
use App\SiteEditor\KeystoneSiteEditorGate;
use App\Support\ContentModel\SpecializedContentTypes;
use App\Support\EnvWriter;
use App\Support\SiteBranding;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\ContentTypeManager;
use ArtisanPackUI\Forms\Models\Form as PackageForm;
use ArtisanPackUI\MediaLibrary\Http\Requests\MediaStoreRequest as PackageMediaStoreRequest;
use ArtisanPackUI\VisualEditor\Resources\ResourceResolver;
use ArtisanPackUI\VisualEditor\SiteEditor\Gates\SiteEditorAccessGate;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;
use ReflectionClass;
use ReflectionException;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Slice 1 Part 2 — bind Keystone's gate ahead of the
        // visual-editor package's fail-closed default. The package uses
        // `bindIf` so this binding wins. Composes the bundled cms-
        // framework install probe with an admin-role check.
        $this->app->bind(SiteEditorAccessGate::class, KeystoneSiteEditorGate::class);

        // The vendor MediaStoreRequest has a closed MIME→extension map
        // that silently drops mimes it doesn't recognize (e.g. audio/x-m4a),
        // so the `mimes:` rule rejects uploads even after the config allows
        // them. Bind our subclass with the extra mappings.
        $this->app->bind(PackageMediaStoreRequest::class, KeystoneMediaStoreRequest::class);

        // Bound as a singleton so the `/install` controller and tests
        // share the same instance — tests rebind it against a temp path
        // instead of the real `.env`.
        $this->app->singleton(EnvWriter::class, fn ($app) => EnvWriter::fromApplication($app));

        // #110 — pre-flight SSRF guard for plugin update_url fetches.
        // Bound as scoped so a config override in tests picks up on the
        // next resolve without leaking across requests.
        $this->app->scoped(PluginUpdateUrlGuard::class, static fn () => PluginUpdateUrlGuard::fromConfig());
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::before(function (User $user, string $ability, array $arguments = []): ?bool {
            // Defer to DynamicContentEditorModelPolicy for dynamic-
            // content-type authz so the `show_in_admin=false` and
            // "still-registered" checks aren't skipped when the caller
            // is an admin. `Gate::before` returning true short-circuits
            // the policy entirely; returning null falls through to it.
            foreach ($arguments as $arg) {
                if ($arg instanceof DynamicContentEditorModel) {
                    return null;
                }
            }

            return $user->hasRole('admin') ? true : null;
        });

        // #111 — the visual editor's `ResourceContentController` calls
        // `Gate::authorize('view'|'update', $model)` for every request,
        // so without a policy every dynamic-content-type edit 403s.
        Gate::policy(DynamicContentEditorModel::class, DynamicContentEditorModelPolicy::class);

        // Swap the framework's `ResourceResolver` for our subclass so
        // `DynamicContentEditorModel` gets its `$table` set at the
        // exact seam where the URL's resource slug is known —
        // eliminating the need for the model constructor to reach into
        // the current request. Extended (not rebound) so the framework
        // provider's `->instance()` call still owns the resources map;
        // we just wrap the instance into a subclass with the same map.
        $this->app->extend(ResourceResolver::class, static function (ResourceResolver $existing): ResourceResolver {
            // Reflection on a non-public vendor property: a vendor
            // rename of `resources` (or a repackaged resolver that
            // dropped the property) would explode boot before any
            // request is served. If the shape moves under us, keep
            // the vendor resolver — dynamic content types will fall
            // back to the framework's built-in behavior instead of
            // taking the whole app down.
            try {
                $ref  = new ReflectionClass($existing);
                $prop = $ref->getProperty('resources');
                $prop->setAccessible(true);
                /** @var array<string, class-string> $resources */
                $resources = $prop->getValue($existing);
            } catch (ReflectionException $e) {
                report($e);

                return $existing;
            }

            return new KeystoneResourceResolver($resources);
        });

        // Redirect the visual-editor's post-comments-form submissions
        // away from cms-framework's JSON REST endpoint and onto our
        // `comments.store` route so guest visitors get the standard
        // browser-form UX (POST → 303 → GET with a flash message)
        // instead of landing on raw JSON. The block renderer reads
        // this filter via `applyFilters('comments.form.action', ...)`.
        if (function_exists('addFilter')) {
            // #111 — register every Keystone-persisted content type in
            // the visual-editor resource map so `/visual-editor/api/
            // {slug}/{id}/content` resolves through
            // {@see DynamicContentEditorModel}. Reserved slugs (`post`,
            // `page`, `posts`, `pages`) already have specialized model
            // classes registered by the framework — never overwrite
            // those. Wrapped in try/catch so a missing content_types
            // table (fresh install pre-migration) doesn't trip boot.
            addFilter('ap.visual-editor.resources', function (array $map): array {
                try {
                    $manager = app(ContentTypeManager::class);
                } catch (Throwable) {
                    return $map;
                }

                try {
                    $registered = $manager->getRegisteredContentTypes();
                } catch (Throwable) {
                    return $map;
                }

                foreach ($registered as $slug => $entry) {
                    $entrySlug = is_array($entry) ? (string) ($entry['slug'] ?? $slug) : (string) $slug;

                    if (SpecializedContentTypes::contains($entrySlug)) {
                        continue;
                    }
                    if (! is_array($entry) || ! isset($entry['id'])) {
                        // Filter-registered types own their model_class;
                        // don't overwrite them with the generic model.
                        continue;
                    }
                    // Types the admin deliberately hid (show_in_admin=false)
                    // must NOT be reachable via /visual-editor/api/{slug}/{id};
                    // otherwise an editor who guesses the slug bypasses
                    // the sidebar's visibility gate and can read/write
                    // hidden records.
                    if (false === ($entry['show_in_admin'] ?? true)) {
                        continue;
                    }
                    if (isset($map[$entrySlug])) {
                        continue;
                    }

                    $map[$entrySlug] = DynamicContentEditorModel::class;
                }

                return $map;
            });

            addFilter('comments.form.action', fn () => route('comments.store'));

            // Local-env convenience: auto-approve guest comments so the
            // submit-and-render flow is testable end-to-end without
            // hopping into the moderation queue. Production should keep
            // the default `pending` behavior and surface a moderation
            // UI for approval.
            if (app()->environment('local')) {
                addFilter(
                    'comments.store.defaultStatus',
                    fn () => \ArtisanPackUI\CMSFramework\Modules\Blog\Models\Comment::STATUS_APPROVED,
                );
            }

            // The visual-editor `artisanpack/loginout` block (#522) emits a
            // plain `<a>` whose `url` comes from the config-defined
            // `logout_route` — Breeze's `logout` is POST + CSRF, so the
            // anchor would land on a 405 without a GET-side bridge.
            // Swap the URL for a signed link to `loginout.logout-link`
            // (handled by AuthenticatedSessionController::destroyViaLink),
            // preserving the resolver's own `redirect_to` query param so
            // the post-logout redirect stays on the originating page.
            addFilter(
                'ap.visual-editor.loginout.envelope',
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

        // The Inertia root template emits its favicon from the configured
        // brand logo (site.logo_id), matching the public theme's behavior.
        View::composer('app', function ($view): void {
            $view->with('siteIcon', SiteBranding::icon());
        });

        // Override the artisanpack-ui/forms route binding so admin and
        // API consumers can address a form by its primary key (stable
        // across renames) while public visitors keep slug-based URLs.
        //
        // The package's `Form::getRouteKeyName()` returns 'slug', so
        // without this an in-progress slug edit would break the very
        // PUT request trying to persist it. Admin web routes already
        // opt into `{form:id}` (see `routes/admin.php`) and skip this
        // closure entirely; the API + public surfaces hit it.
        //
        // Numeric-first across all routes (the previous behavior) lets
        // a public visitor's slug like `2024` resolve as form id 2024
        // instead — wrong record, hard-to-debug bug. Dispatching on
        // the matched route name keeps the public path slug-only and
        // the API path id-only without that ambiguity.
        Route::bind('form', function (string $value): PackageForm {
            $request = request();

            $isIdRoute = ctype_digit($value)
                && ($request->routeIs('api.forms.*') || $request->routeIs('admin.forms.*'));

            if ($isIdRoute) {
                return PackageForm::query()->findOrFail((int) $value);
            }

            return PackageForm::query()->where('slug', $value)->firstOrFail();
        });
    }
}
