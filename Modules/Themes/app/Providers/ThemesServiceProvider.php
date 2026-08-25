<?php

declare(strict_types=1);

namespace Modules\Themes\Providers;

use App\Providers\KeystoneModuleServiceProvider;
use ArtisanPackUI\CMSFramework\Modules\Themes\Managers\ThemeManager;
use Modules\Themes\Support\ThemeActivationBridge;

/**
 * Boots the Themes module.
 *
 * There was no `app/Providers/*ServiceProvider.php` to absorb here (#214) —
 * themes are artisanpack-ui/cms-framework's Themes module, which owns the
 * `ThemeManager`, the theme registry and the `theme.*` settings. Keystone's
 * module is the surface around it: the `/admin/site-design/themes` upload and
 * activation UI, the Business Info panel, the static-asset server that lets
 * themes live outside `public/`, and the template locator the public renderers
 * resolve theme templates through. So `bootstrap/providers.php` is untouched by
 * the extraction, and `database/` was stripped from the generated scaffolding
 * along with its two autoload entries rather than committed empty — the module
 * owns no table, no factory and no seeder.
 *
 * Three hook registrations moved out of `App\Providers\AppServiceProvider::boot()`
 * and all three are safe at this provider's earlier boot slot; see {@see boot()}.
 * Nothing here reads `SettingsManager`, so the §7 step-4 boot-order trap
 * (plans/14-modular-laravel-setup.md — a module provider now boots ahead of
 * `App\Providers\SettingsServiceProvider`, so `SettingsManager::getSetting()`
 * returns `null` for keys whose defaults have not been registered yet) does not
 * apply. The `theme.*` settings the module depends on are read per request
 * inside the controllers and the locator, long after every provider has booted.
 *
 * Two things stayed in core on purpose:
 *
 * - **`App\Support\SiteBranding`**, which the §4 row lists here. It resolves
 *   cms-framework's `site.logo_id` — a *site* setting registered by the central
 *   `SettingsServiceProvider`, not a theme one — and three of its five callers
 *   are core files §3.5 keeps central, including `HandleInertiaRequests`, which
 *   runs on every Inertia request. It depends on nothing in this module. See
 *   the Row 13 note in the plan for the full argument.
 * - **The `View::composer('app', ...)` that emits the favicon** from
 *   `SiteBranding::icon()`, which follows it for the same reason: it brands the
 *   *admin* root template, and would still be needed if every theme were
 *   uninstalled.
 */
class ThemesServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Themes';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'themes';

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        RouteServiceProvider::class,
    ];

    /**
     * Bootstrap the module.
     *
     * Registers the three theme hooks that used to live in
     * `App\Providers\AppServiceProvider::boot()`. All three are Themes-owned:
     * each bridges a vendor `ap.cmsFramework.theme.*` action to the
     * Keystone-branded equivalent, so subscribers can hook a single canonical
     * name regardless of whether the switch originated in this module's admin
     * controller or in a CLI/artisan path.
     *
     * Safe to register earlier in the provider chain than `AppServiceProvider`,
     * where all three used to live. Actions fire every registered listener
     * rather than being last-registration-wins, so the earlier slot could only
     * matter if something else registered on the same three hook names —
     * nothing in the app or in vendor does. The closures resolve `ThemeManager`
     * from the container lazily, when a theme is actually activated, not now.
     *
     * The `function_exists` guard is carried over verbatim from
     * `AppServiceProvider`: the hooks helpers come from artisanpack-ui/hooks
     * via composer `files` autoloading, and the guard keeps boot alive on an
     * install where that package is absent.
     */
    public function boot(): void
    {
        parent::boot();

        if (! function_exists('addAction')) {
            return;
        }

        // #132 — CLI/programmatic parity for theme installs. The Keystone admin
        // path goes through {@see \Modules\Themes\Services\ThemeInstaller},
        // which never calls vendor's `installTheme()`, so the two emit sites
        // don't overlap.
        addAction('ap.cmsFramework.theme.installed', function ($slug, $manifest = null): void {
            doAction('keystone.admin.themes.installed', $slug, $manifest);
        });

        // #156 (post-review fix) — bridge vendor theme activation so
        // `keystone.themes.activated` fires for every surface (admin
        // controller, installer, CLI, programmatic). The pre-switch
        // `activating` fire snapshots the currently-active theme so the
        // post-switch payload can hand subscribers `{previousSlug, newSlug}`.
        addAction('ap.cmsFramework.theme.activating', function ($slug = null, $theme = null): void {
            ThemeActivationBridge::onActivating(app(ThemeManager::class));
        });
        addAction('ap.cmsFramework.theme.activated', function ($slug, $theme = null): void {
            ThemeActivationBridge::onActivated((string) $slug);
        });
    }
}
