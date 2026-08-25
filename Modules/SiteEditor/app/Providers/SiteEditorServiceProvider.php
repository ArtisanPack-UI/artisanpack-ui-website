<?php

declare(strict_types=1);

namespace Modules\SiteEditor\Providers;

use App\Providers\KeystoneModuleServiceProvider;
use ArtisanPackUI\VisualEditor\Resources\ResourceResolver;
use ArtisanPackUI\VisualEditor\SiteEditor\Gates\SiteEditorAccessGate;
use Modules\SiteEditor\Gates\KeystoneSiteEditorGate;
use Modules\SiteEditor\Resources\KeystoneResourceResolver;
use ReflectionClass;
use Throwable;

/**
 * Boots the SiteEditor module.
 *
 * This is the first extraction since Updater (#206) to absorb a provider —
 * the eight modules in between each left `bootstrap/providers.php` untouched.
 * `App\Providers\DashboardWidgetServiceProvider` moved here whole and now
 * registers through {@see $providers} instead of that file. The widget map
 * stays a separate class rather than being folded into this one — it is the
 * single point of edit for Keystone's built-in widgets, and the React-side
 * mirror at `resources/js/lib/admin/widgets/index.ts` points at it by name.
 *
 * Two registrations also moved out of `App\Providers\AppServiceProvider`: the
 * `SiteEditorAccessGate` binding ({@see register()}) and the
 * `ResourceResolver` swap ({@see boot()}). Neither reads app-provider state,
 * so the §7 step-4 boot-order trap (plans/14-modular-laravel-setup.md — a
 * module provider now boots ahead of `App\Providers\SettingsServiceProvider`,
 * so `SettingsManager::getSetting()` returns `null` for keys whose defaults
 * have not been registered yet) does not apply. See each method for why the
 * earlier position is safe on its own terms.
 *
 * `database/` keeps `migrations/` and `factories/` — the `dashboards` table
 * moved with its filename unchanged (§3.6, so `migrate:status` still reports
 * it `Ran`) and `DashboardFactory` came with it, which is why
 * {@see \Modules\SiteEditor\Models\Dashboard} declares a `newFactory()`
 * override. The generated `seeders/` directory was stripped along with its
 * autoload entry; the module seeds nothing.
 */
class SiteEditorServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'SiteEditor';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'siteeditor';

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        DashboardWidgetServiceProvider::class,
        RouteServiceProvider::class,
    ];

    /**
     * Register the module's container bindings.
     *
     * Binds Keystone's gate ahead of the visual-editor package's fail-closed
     * default. The package uses `bindIf`, so this binding wins whichever
     * provider registers first: register earlier and the package's `bindIf`
     * sees the key already taken and skips; register later and this call
     * simply overwrites. Composes the bundled cms-framework install probe
     * with an admin-role check.
     */
    public function register(): void
    {
        parent::register();

        $this->app->bind(SiteEditorAccessGate::class, KeystoneSiteEditorGate::class);
    }

    /**
     * Bootstrap the module.
     *
     * Swaps the framework's `ResourceResolver` for our subclass so
     * `DynamicContentEditorModel` gets its `$table` set at the exact seam
     * where the URL's resource slug is known — eliminating the need for the
     * model constructor to reach into the current request. Extended (not
     * rebound) so the framework provider's `->instance()` call still owns the
     * resources map; we just wrap the instance into a subclass with the same
     * map.
     *
     * Moving this off `AppServiceProvider::boot()` does not change when it
     * runs relative to the package. `VisualEditorServiceProvider::register()`
     * binds `ResourceResolver` as a singleton and its `boot()` defers the real
     * map build to an `$app->booted()` callback, so at *any* point in the boot
     * phase — old position or new — the abstract is a binding rather than a
     * resolved instance, and `extend()` does the same thing: append the
     * extender for the next resolve. The relative order this module's boot()
     * has against the package's boot() is therefore not load-bearing.
     *
     * Known pre-existing defect, carried across unchanged rather than fixed
     * here: that deferred `$app->booted()` callback ends in
     * `$app->instance(ResourceResolver::class, new ResourceResolver($map))`,
     * and `Container::instance()` writes `instances[$abstract]` directly
     * without running extenders — which `resolve()` then short-circuits on. So
     * this extender never actually fires, and `app(ResourceResolver::class)`
     * returns the vendor class. That was equally true at the old call site
     * (`booted()` callbacks run strictly after every provider's `boot()`), so
     * a behaviour-preserving extraction keeps it as-is; fixing it means
     * `$app->rebinding()` or a `booted()` callback of our own, and belongs in
     * its own issue with its own dynamic-content-type coverage.
     */
    public function boot(): void
    {
        parent::boot();

        $this->app->extend(ResourceResolver::class, static function (ResourceResolver $existing): ResourceResolver {
            // Reflection on a non-public vendor property: a vendor
            // rename of `resources` (or a repackaged resolver that
            // dropped the property) would explode boot before any
            // request is served. If the shape moves under us, keep
            // the vendor resolver — dynamic content types will fall
            // back to the framework's built-in behavior instead of
            // taking the whole app down.
            //
            // `Throwable`, not `ReflectionException`: a renamed property is
            // only one of the ways this can fail. `getValue()` raises `Error`
            // — not an exception — when the property exists but is typed and
            // uninitialized, which is what a vendor refactor to constructor
            // promotion with a nullable default would produce. Catching the
            // narrow type there would defeat the whole point of the guard.
            try {
                $ref  = new ReflectionClass($existing);
                $prop = $ref->getProperty('resources');
                $prop->setAccessible(true);
                $resources = $prop->getValue($existing);
            } catch (Throwable $e) {
                report($e);

                return $existing;
            }

            // Same reasoning one step later: the property could survive a
            // rename but change shape, and `KeystoneResourceResolver`'s
            // constructor would then raise `TypeError` outside the try.
            if (! is_array($resources)) {
                return $existing;
            }

            /** @var array<string, class-string> $resources */
            return new KeystoneResourceResolver($resources);
        });
    }
}
