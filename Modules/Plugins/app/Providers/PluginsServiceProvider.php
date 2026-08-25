<?php

declare(strict_types=1);

namespace Modules\Plugins\Providers;

use App\Providers\KeystoneModuleServiceProvider;
use App\Support\Hooks;
use ArtisanPackUI\CMSFramework\Modules\Plugins\Managers\PluginManager;
use Modules\Plugins\Services\PluginUpdateUrlGuard;
use Modules\Plugins\Support\KeystonePluginManager;

/**
 * Boots the Plugins module.
 *
 * Plugins themselves are artisanpack-ui/cms-framework's Plugins module — it
 * owns the `plugins` table, the `PluginManager` install/activate/uninstall
 * lifecycle and the `UpdateManager`. Keystone's module is the surface around
 * it: the admin-only `/admin/system/plugins` screen, the SSRF guard every
 * update-manifest fetch is funnelled through (#110), the `PluginManager`
 * subclass that emits per-plugin boot hooks (#156), and the federated-module
 * manifest that lets an active plugin ship its own Inertia pages.
 *
 * There was no `app/Providers/*ServiceProvider.php` to absorb, so
 * `bootstrap/providers.php` is untouched by this extraction; two `register()`
 * bindings and six `boot()` registrations moved out of
 * `App\Providers\AppServiceProvider` instead. `database/` was stripped from
 * the generated scaffolding along with its autoload entries rather than
 * committed empty — the module owns no table, no factory and no seeder.
 *
 * Nothing here reads `SettingsManager`, so the §7 step-4 boot-order trap
 * (plans/14-modular-laravel-setup.md — a module provider now boots ahead of
 * `App\Providers\SettingsServiceProvider`, so `SettingsManager::getSetting()`
 * returns `null` for keys whose defaults have not been registered yet) does
 * not apply. See {@see register()} and {@see boot()} for why each moved
 * registration is safe at the earlier slot on its own terms.
 *
 * Three plugin-adjacent things stayed in core on purpose:
 *
 * - **`App\Support\Hooks`**, the `safeDoAction` wrapper this provider and
 *   {@see KeystonePluginManager} both use. It is the app-wide hook-safety
 *   helper, not a plugins concern (§3.5).
 * - **`resources/js/components/plugins/PluginErrorBoundary.tsx` and
 *   `resources/js/lib/plugins/federated-loader.ts`.** Both are imported by
 *   `resources/js/app.tsx` at boot to build the federated page resolver;
 *   moving them would make a core entry point import
 *   `@modules/Plugins/...`, which is the dependency direction this migration
 *   exists to remove. Same call made for the dashboard widget barrel in #215.
 * - **The federated-manifest Inertia share** in
 *   `App\Http\Middleware\HandleInertiaRequests`, which now reaches into
 *   {@see \Modules\Plugins\Support\FederatedModuleManifest}. The middleware is
 *   core per §3.5 and shares one prop per subsystem; a core→module call here
 *   is the same shape as `KeystoneShellController`'s reach into
 *   `KeystoneSampleData`.
 */
class PluginsServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Plugins';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'plugins';

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        RouteServiceProvider::class,
    ];

    /**
     * Register the module's container bindings.
     *
     * Both bindings moved verbatim from `AppServiceProvider::register()`.
     * Neither is order-sensitive: the guard is built by a closure that only
     * runs on first resolve, long after config is loaded, and `extend()`
     * queues its wrapper against the abstract whether or not the vendor
     * package has bound `PluginManager` yet — `Container::extend()` stores
     * the extender on `$extenders` for an unbound abstract and applies it at
     * resolve time. The vendor singleton is not resolved during any
     * `register()`, so the earlier slot changes nothing.
     */
    public function register(): void
    {
        parent::register();

        // #110 — pre-flight SSRF guard for plugin update_url fetches.
        // Bound as scoped so a config override in tests picks up on the
        // next resolve without leaking across requests.
        $this->app->scoped(PluginUpdateUrlGuard::class, static fn () => PluginUpdateUrlGuard::fromConfig());

        // #156 — swap the framework PluginManager for the Keystone
        // subclass so `loadActivePlugins()` fires `keystone.plugins.booting`
        // per plugin. `extend` wraps whatever binding is currently on the
        // container, so this composes cleanly with the vendor package's
        // own singleton registration regardless of provider order.
        $this->app->extend(PluginManager::class, static fn (): KeystonePluginManager => new KeystonePluginManager);
    }

    /**
     * Bootstrap the module.
     *
     * The `booted()` registration and the five vendor hook bridges moved from
     * `AppServiceProvider::boot()`. `booted()` fires at the end of the
     * container boot cycle no matter which provider queued it, and actions
     * fire every registered listener rather than being
     * last-registration-wins, so the earlier slot could only matter if
     * something else registered on the same five hook names — nothing in the
     * app or in vendor does.
     *
     * The `function_exists` guard is carried over verbatim from
     * `AppServiceProvider`: the hooks helpers come from artisanpack-ui/hooks
     * via composer `files` autoloading, and the guard keeps boot alive on an
     * install where that package is absent.
     *
     * One behavior change rides along with the move: the five bridges now
     * re-emit through {@see Hooks::safeDoAction()} instead of a bare
     * `doAction()`. See the inline note below.
     */
    public function boot(): void
    {
        parent::boot();

        // #156 — the aggregate "all plugins booted" signal fires once
        // the framework has finished registering every plugin service
        // provider. `booted()` runs at the very end of the container
        // boot cycle, after every provider's own `boot()` — so
        // subscribers see the fully-wired container. Wrapped in
        // `safeDoAction` because Laravel propagates callback throws
        // through `fireCallbacks`; without the guard, one broken
        // subscriber would 500 every request or fail app boot outright.
        $this->app->booted(static function (): void {
            Hooks::safeDoAction('keystone.plugins.booted');
        });

        if (! function_exists('addAction')) {
            return;
        }

        // #131 — Bridge vendor plugin-lifecycle hooks to the
        // Keystone-branded equivalents so subscribers can hook a
        // single canonical name regardless of whether the mutation
        // originated in the admin controller or a CLI/artisan path.
        // The controller intentionally does NOT re-emit these
        // events — the bridge covers both surfaces uniformly.
        //
        // `safeDoAction` rather than a bare `doAction`: every one of these
        // five fires strictly *after* the framework has already installed,
        // flipped or deleted the plugin, so the mutation is committed by the
        // time a subscriber runs. The hooks package dispatches callbacks with
        // no exception isolation, so an unguarded emit would let one broken
        // subscriber turn a completed uninstall into a 500 — and, on the
        // CLI/installer path, abort the caller mid-run. Exceptions still reach
        // the logs via `report()`.
        addAction('ap.cmsFramework.plugin.installed', function ($slug, $plugin = null): void {
            Hooks::safeDoAction('keystone.admin.plugins.installed', $slug, $plugin);
        });
        addAction('ap.cmsFramework.plugin.activated', function ($slug, $plugin = null): void {
            Hooks::safeDoAction('keystone.admin.plugins.activated', $slug, $plugin);
        });
        addAction('ap.cmsFramework.plugin.deactivated', function ($slug): void {
            Hooks::safeDoAction('keystone.admin.plugins.deactivated', $slug);
        });
        addAction('ap.cmsFramework.plugin.updated', function ($slug, $newVersion = null): void {
            Hooks::safeDoAction('keystone.admin.plugins.updated', $slug, $newVersion);
        });
        addAction('ap.cmsFramework.plugin.deleted', function ($slug): void {
            Hooks::safeDoAction('keystone.admin.plugins.deleted', $slug);
        });
    }
}
