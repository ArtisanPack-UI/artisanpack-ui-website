<?php

declare(strict_types=1);

namespace App\Providers;

use Nwidart\Modules\Support\ModuleServiceProvider;

/**
 * Base provider for every Keystone module, sitting between the module's own
 * provider and nwidart's.
 *
 * It exists for one reason: nwidart registers a Blade view path for a module
 * whether or not the module has one, and Keystone's modules deliberately have
 * none. See {@see registerViews()}.
 */
abstract class KeystoneModuleServiceProvider extends ModuleServiceProvider
{
    /**
     * Register the module's Blade views — but only if it actually has any.
     *
     * Keystone modules ship no Blade: `config/modules.php` turns the `views`
     * generator off, and every module screen is an Inertia page under
     * `resources/js/pages`. nwidart's `registerViews()` calls
     * `loadViewsFrom(module_path($name, 'resources/views'))` unconditionally
     * all the same, so all sixteen modules register a directory that does not
     * exist.
     *
     * That is inert until something walks the registered view paths.
     * `view:cache` does, with Symfony Finder, which throws
     * `DirectoryNotFoundException` on the first missing directory — so one
     * absent folder breaks view caching for the entire application, and takes
     * the installer's cache step (`InstallationService::cacheFramework()`,
     * which aborts the whole step on the first failing command) with it.
     *
     * Deferring to the parent when the directory does exist means a module
     * that later grows Blade views gets the full nwidart treatment —
     * namespace, publish tag, component namespace — with no change here.
     */
    protected function registerViews(): void
    {
        $relativePath = (string) config('modules.paths.generator.views.path');

        // Guard the empty case explicitly: `module_path($name, '')` resolves to
        // the module root, which always exists, so a missing or blank config
        // value would hand Blade the whole module directory as a view path.
        if ('' === $relativePath || ! is_dir(module_path($this->name, $relativePath))) {
            return;
        }

        parent::registerViews();
    }
}
