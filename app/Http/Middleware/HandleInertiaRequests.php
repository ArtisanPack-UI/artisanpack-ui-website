<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\AdminMenu\AdminMenuBuilder;
use App\Support\AdminTheme;
use App\Support\KeystoneSampleData;
use App\Support\NotificationItemPayload;
use App\Support\Permissions\PermissionSlugResolver;
use App\Support\Plugins\FederatedModuleManifest;
use App\Support\SiteBranding;
use ArtisanPackUI\CMSFramework\Modules\Core\Updates\ValueObjects\UpdateInfo;
use ArtisanPackUI\CMSFramework\Modules\Settings\Managers\SettingsManager;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        $user     = $request->user();
        $features = [
            'blog'      => (bool) keystone('features.blog', false),
            'forms'     => (bool) keystone('features.forms', false),
            'analytics' => (bool) keystone('features.analytics', false),
            'ecommerce' => (bool) keystone('features.ecommerce', false),
            'booking'   => (bool) keystone('features.booking', false),
        ];

        return [
            ...parent::share($request),
            'name'  => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth'  => [
                'user'        => $user,
                'roles'       => null === $user ? [] : $user->roles->pluck('slug')->all(),
                'permissions' => null === $user ? [] : app(PermissionSlugResolver::class)->slugsFor($user),
            ],
            'keystone' => [
                'me'            => $user
                    ? [
                        'name'      => $user->display_name,
                        'email'     => $user->email,
                        'handle'    => $user->username,
                        'role'      => $user->roles->first()?->name ?? 'Member',
                        'initials'  => str($user->display_name)
                            ->explode(' ')
                            ->take(2)
                            ->map(fn (string $part) => str($part)->substr(0, 1)->upper()->toString())
                            ->implode(''),
                        'photo_url' => $user->loadMissing('profilePhoto')->profilePhoto?->url() ?: null,
                    ]
                    : KeystoneSampleData::me(),
                'site'            => $this->site(),
                'brand'           => $this->brand(),
                'version'         => (string) config('app.version', '0.0.0'),
                'adminTheme'      => AdminTheme::palette(),
                'notifications'   => NotificationItemPayload::forUser($user, limit: 10),
                'features'        => $features,
                'adminMenu'       => app(AdminMenuBuilder::class)->build($user, $features),
                'updateAvailable' => $this->updateAvailable($user),
                'formats'         => $this->localizationFormats(),
                'globalContent'   => $this->globalContent(),
                'privacy'         => [
                    // Share the vendor package's runtime API prefix so
                    // the React admin (`resources/js/lib/vendor/privacy-
                    // endpoints.ts`) targets the same path the package
                    // registered — an override of
                    // `PRIVACY_ROUTES_API_PREFIX` (or the config key)
                    // doesn't silently break the admin fetch calls.
                    'api_prefix' => '/'.trim((string) config('artisanpack.privacy.routes.api_prefix', 'api/privacy'), '/'),
                ],
                'performance'     => [
                    // Same shape as `privacy.api_prefix` — the perf
                    // admin's React screens fetch against the vendor's
                    // JSON API, and this exposes the effective prefix so
                    // a `PERF_ROUTES_API_PREFIX` override on the server
                    // survives to the client without a rebuild.
                    'api_prefix' => '/'.trim((string) config('artisanpack.performance.routes.api_prefix', 'api/performance'), '/'),
                ],
                'federatedModules' => $this->federatedModules($user),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error'   => fn () => $request->session()->get('error'),
                'info'    => fn () => $request->session()->get('info'),
                'warning' => fn () => $request->session()->get('warning'),
            ],
        ];
    }

    /**
     * Site metadata for the admin shell's "CURRENTLY EDITING" surfaces:
     * the configured business name + URL plus the app's environment. Shared
     * globally as `keystone.site` and reused by
     * {@see \App\Http\Controllers\Admin\KeystoneShellController::siteDesign()}
     * so every render — sidebar, top bar, Site Design page — reflects the
     * same settings source rather than the seeded design-port placeholder.
     *
     * @return array{name: string, url: string, environment: string, last_published: string|null}
     */
    public function siteMetadata(): array
    {
        $settings = app(SettingsManager::class);

        return [
            'name'           => (string) $settings->getSetting('site.title'),
            'url'            => (string) ($settings->getSetting('site.url') ?: url('/')),
            'environment'    => app()->environment(),
            'last_published' => null,
        ];
    }

    /**
     * Real site branding for the admin shell: the configured site title and
     * homepage URL plus the brand logo URL (`site.logo_id`). Drives the
     * sidebar brand mark so the admin chrome reflects the live settings
     * rather than hardcoded product text, and links back to the site.
     *
     * @return array{name: string, url: string, logoUrl: string|null}
     */
    private function brand(): array
    {
        $settings = app(SettingsManager::class);

        return [
            'name'    => (string) $settings->getSetting('site.title'),
            'url'     => (string) ($settings->getSetting('site.url') ?: url('/')),
            'logoUrl' => SiteBranding::logoUrl(),
        ];
    }

    private function site(): array
    {
        return $this->siteMetadata();
    }

    /**
     * The "create once, use everywhere" surface (UX principle #4). Every
     * `global.*` setting registered in
     * {@see \App\Providers\SettingsServiceProvider::registerGlobalContentSettings()}
     * is exposed under `keystone.globalContent` so any React page can
     * read `usePage().props.keystone.globalContent.phone` without making
     * a per-page round-trip.
     *
     * @return array{
     *     business_name: string,
     *     phone: string,
     *     email: string,
     *     address: array<string, string>,
     *     hours: array<string, array{open: string, close: string, closed: bool}>,
     *     social_links: list<array{platform: string, url: string}>,
     * }
     */
    private function globalContent(): array
    {
        $settings = app(SettingsManager::class);

        return [
            'business_name' => (string) $settings->getSetting('global.business_name'),
            'phone'         => (string) $settings->getSetting('global.phone'),
            'email'         => (string) $settings->getSetting('global.email'),
            'address'       => (array) $settings->getSetting('global.address'),
            'hours'         => (array) $settings->getSetting('global.hours'),
            'social_links'  => (array) $settings->getSetting('global.social_links'),
        ];
    }

    /**
     * The General localization settings the React date formatter needs to
     * render user-facing dates in the configured format, timezone, and
     * locale. Mirrors the keys consumed server-side by
     * {@see \App\Support\DateFormatter}.
     *
     * @return array{date: string, time: string, timezone: string, locale: string}
     */
    private function localizationFormats(): array
    {
        $settings = app(SettingsManager::class);

        return [
            'date'     => (string) $settings->getSetting('general.dateFormat'),
            'time'     => (string) $settings->getSetting('general.timeFormat'),
            'timezone' => (string) $settings->getSetting('general.timezone'),
            'locale'   => (string) $settings->getSetting('general.locale'),
        ];
    }

    /**
     * The page-name-keyed federated module manifest passed to the Inertia
     * resolver so plugin React pages installed at runtime can be loaded
     * over Module Federation.
     *
     * Only surfaced to viewers who can reach the plugin admin (admin role).
     * Plugin `remoteEntry.js` URLs and internal remote names are sensitive
     * infrastructure metadata — leaking them to guest visitors of public
     * Inertia pages hands an attacker a plugin-fingerprint of the site
     * plus the exact bundles to fetch and replay for known-CVE analysis.
     *
     * The framework's PluginRegistry populates the
     * `ap.plugins.federatedModules` filter with active plugins' descriptors;
     * {@see FederatedModuleManifest} flattens that shape into the
     * per-page-name lookup the client resolver expects.
     *
     * @return array{
     *     pages: array<string, array{remote: string, entry: string, module: string}>,
     *     bootModules: list<array{remote: string, entry: string, module: string}>,
     * }
     */
    private function federatedModules(?User $user): array
    {
        if (null === $user || ! $user->hasRole('admin')) {
            return ['pages' => [], 'bootModules' => []];
        }

        /** @var array<string, array{entry?: mixed, exposes?: mixed, bootModule?: mixed}> $registry */
        $registry = (array) applyFilters('ap.plugins.federatedModules', []);

        return app(FederatedModuleManifest::class)->build($registry);
    }

    /**
     * The "update available" banner payload shown on the dashboard.
     *
     * Reads the `cms.update_available` cache key the framework's
     * `update:check-scheduled` command writes once per day, and only
     * surfaces it to users who can actually run the updater. Returns
     * null when no update is pending, the viewer can't run updates, or
     * the cached payload has been invalidated.
     *
     * Gate matches `/admin/settings/updates`: admin role AND the
     * `updater.run` permission. Checking both — rather than relying on
     * role alone — defends against a future config drift where an admin
     * loses the permission and would otherwise see a banner pointing at
     * a page that 403s them.
     *
     * @return array{latest_version: string, current_version: string, release_url: string|null, release_date: string|null}|null
     */
    private function updateAvailable(?User $user): ?array
    {
        if (null === $user || ! $user->hasRole('admin')) {
            return null;
        }

        if (! in_array('updater.run', app(PermissionSlugResolver::class)->slugsFor($user), true)) {
            return null;
        }

        $cached = Cache::get('cms.update_available');

        if (! $cached instanceof UpdateInfo || ! $cached->hasUpdate()) {
            return null;
        }

        return [
            'latest_version'  => $cached->latestVersion,
            'current_version' => $cached->currentVersion,
            'release_url'     => $cached->metadata['release_url'] ?? null,
            'release_date'    => $cached->releaseDate,
        ];
    }
}
