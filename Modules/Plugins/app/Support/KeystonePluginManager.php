<?php

declare(strict_types=1);

namespace Modules\Plugins\Support;

use App\Support\Hooks;
use ArtisanPackUI\CMSFramework\Modules\Plugins\Managers\PluginManager;
use ArtisanPackUI\CMSFramework\Modules\Plugins\Models\Plugin;
use Throwable;

/**
 * Keystone-flavored {@see PluginManager} that fires the Keystone
 * `keystone.plugins.booting` action before each plugin's service
 * provider registers during application boot. The aggregate
 * `keystone.plugins.booted` action is emitted from
 * {@see \Modules\Plugins\Providers\PluginsServiceProvider::boot()} via
 * `app()->booted()` so subscribers see the fully-registered container.
 *
 * We override `loadActivePlugins()` rather than reaching into the vendor
 * class's private surface so a vendor bugfix to the load loop keeps
 * working; the per-plugin `booting` emit is layered on top.
 *
 * The vendor bug we intentionally do NOT paper over: when a plugin's
 * service provider throws during registration, the vendor logs and
 * continues. We mirror that behavior so a misbehaving plugin can't
 * abort the boot chain, and we still fire `booting` for every active
 * plugin so a subscriber can correlate `booting` with a later boot
 * failure surfaced through its own listener.
 */
class KeystonePluginManager extends PluginManager
{
    public function loadActivePlugins(): void
    {
        $activePlugins = Plugin::active()->get();

        foreach ($activePlugins as $plugin) {
            /** @var Plugin $plugin */
            // Wrapped: a throwing subscriber here would abort the loop
            // and block every subsequent plugin's autoloader + service
            // provider from registering for the rest of the request.
            Hooks::safeDoAction('keystone.plugins.booting', $plugin->slug, $plugin);

            if (isset($plugin->meta['autoload'])) {
                $this->registerAutoloader($plugin->slug, $plugin->meta['autoload']);
            }

            if ($plugin->hasServiceProvider()) {
                try {
                    app()->register($plugin->service_provider);
                } catch (Throwable $e) {
                    logger()->error("Failed to register plugin service provider: {$plugin->slug}", [
                        'exception' => $e->getMessage(),
                    ]);
                }
            }
        }
    }
}
