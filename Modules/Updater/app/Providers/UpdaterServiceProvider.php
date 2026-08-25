<?php

declare(strict_types=1);

namespace Modules\Updater\Providers;

use App\Providers\KeystoneModuleServiceProvider;
use ArtisanPackUI\CMSFramework\Modules\Core\Updates\Enums\UpdateType;
use ArtisanPackUI\CMSFramework\Modules\Core\Updates\Managers\ApplicationUpdateManager;
use ArtisanPackUI\CMSFramework\Modules\Core\Updates\UpdateCheckerFactory;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Foundation\Application;

/**
 * Boots the Updater module and wires the cms-framework Updates module
 * against Keystone's GitLab source.
 *
 * This is `App\Providers\UpdatesServiceProvider` moved wholesale into the
 * module (#206) and re-parented onto {@see KeystoneModuleServiceProvider},
 * through which it inherits nwidart's
 * {@see \Nwidart\Modules\Support\ModuleServiceProvider} behaviour — including
 * registering the module's `RouteServiceProvider`. Apart from the three
 * `$name` / `$nameLower` / `$providers` module-metadata properties and the
 * `parent::` calls, everything here is the pre-existing wiring, unchanged:
 *
 * The framework's Updates module reads `cms.updates.*` config keys and
 * looks up the source URL there. Keystone publishes its own
 * `keystone.updates.*` config so the env surface stays consistent across
 * features; this provider copies the relevant values onto `cms.updates`
 * at boot, attaches the GitLab access token to the update checker, and
 * registers the daily `update:check-scheduled` command.
 *
 * The cms-framework's `ApplicationUpdateManager::getUpdateChecker()`
 * hard-codes the slug `'digital-shopfront-cms'` when it lazily builds
 * its own checker (upstream gap, plans/audit.md #120). Binding a
 * pre-configured singleton here sidesteps that and keeps the cache key
 * stable across installs by exposing `keystone.updates.slug`.
 *
 * Nothing here needs the `$this->app->booted(...)` deferral the Seo module
 * documents (plans/14-modular-laravel-setup.md §7 step 4). Both config
 * namespaces this provider reads at boot — Keystone's `keystone.updates.*`
 * from `config/keystone.php` and the framework's `cms.updates.*`, merged in
 * the cms-framework provider's `register()` — are in place before any
 * provider boots, so booting earlier than `bootstrap/providers.php` did
 * changes nothing about what those reads see. `SettingsManager` is never
 * consulted: the updater's inputs are env-driven, not admin-configured.
 *
 * `config/keystone.php` deliberately stays in the application's `config/`
 * directory rather than moving to `Modules/Updater/config/` — it holds
 * every Keystone feature's env surface (`features`, `admin_role`, and the
 * `updates` block), so it is core config this module happens to read.
 */
class UpdaterServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Updater';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'updater';

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        RouteServiceProvider::class,
    ];

    public function register(): void
    {
        parent::register();

        $this->app->singleton(ApplicationUpdateManager::class, function (Application $app): ApplicationUpdateManager {
            $manager = new ApplicationUpdateManager;

            $url = (string) config('keystone.updates.source_url', '');

            if ('' === $url) {
                return $manager;
            }

            $checker = UpdateCheckerFactory::buildUpdateChecker(
                url: $url,
                type: UpdateType::Application,
                slug: (string) config('keystone.updates.slug', 'jmwd-keystone-cms'),
            );

            $token = (string) config('keystone.updates.gitlab_access_token', '');

            if ('' !== $token) {
                $checker->setAuthentication($token);
            }

            $manager->setUpdateChecker($checker);

            return $manager;
        });
    }

    public function boot(): void
    {
        parent::boot();

        // Bridge Keystone's `keystone.updates.*` env-driven config onto the
        // framework's `cms.updates.*` namespace. The framework's commands
        // and managers read from `cms.updates`, but Keystone's `.env.example`
        // (and the audit follow-ups) own the documented env vars, so the
        // two have to be in sync.
        config([
            'cms.updates.update_source_url'            => config('keystone.updates.source_url'),
            'cms.updates.backup_retention_days'        => config('keystone.updates.backup_retention_days'),
            'cms.updates.gitlab_update_strategy'       => config('keystone.updates.strategy'),
            'cms.updates.gitlab_release_asset_pattern' => config('keystone.updates.release_asset_pattern'),
        ]);

        $this->keepComposerLockInUpdates();

        $this->registerSchedule();
    }

    /**
     * Stop the updater from discarding the release's `composer.lock`.
     *
     * cms-framework <= 2.7.0 ships `composer.lock` in the
     * `cms.updates.exclude_from_update` default, annotated "Rebuilt via
     * composer install". It is not: `composer install` only ever *reads* the
     * lock — `composer update` writes it. On those versions extraction
     * replaced `composer.json` with the release's copy while leaving the
     * site's old lock in place, so the updater's `composer install` aborted
     * on the mismatch:
     *
     *   Required package "artisanpack-ui/cms-framework" is in the lock file
     *   as "2.5.4" but that does not satisfy your constraint "^2.7.1"
     *
     * cms-framework 2.7.1 removes the entry and adds
     * `cms.updates.verify_composer_lock_sync` to name that cause up front,
     * so on a current install this override is a no-op. It stays anyway:
     * the lock and `composer.json` are a matched pair and Keystone should
     * not depend on which framework version a given site happens to be
     * running to get that right — and the modular migration raises the
     * stakes, because `composer-merge-plugin` folds every module's
     * `composer.json` into the root manifest at install time
     * (plans/14-modular-laravel-setup.md §3.8), so the lock is the only
     * record of what that merge resolved to.
     */
    protected function keepComposerLockInUpdates(): void
    {
        $excluded = array_values(array_filter(
            (array) config('cms.updates.exclude_from_update', []),
            static fn (mixed $path): bool => 'composer.lock' !== $path,
        ));

        config(['cms.updates.exclude_from_update' => $excluded]);
    }

    /**
     * Register the daily update-check cron entry.
     *
     * Runs the framework's `update:check-scheduled` (which writes the
     * `cms.update_available` cache key consumed by the Dashboard banner)
     * once per day in production. `runInBackground()` keeps a slow GitLab
     * round-trip from delaying other scheduled jobs in the same minute.
     *
     * Deliberately not nwidart's `configureSchedules()` hook: that resolves
     * the `Schedule` eagerly inside `booted()` on every request, whereas
     * `callAfterResolving` only fires once something already wanted the
     * scheduler — which is the behaviour this entry had before the move.
     */
    protected function registerSchedule(): void
    {
        $this->callAfterResolving(Schedule::class, function (Schedule $schedule): void {
            $schedule->command('update:check-scheduled')
                ->daily()
                ->runInBackground()
                ->onOneServer()
                ->name('keystone:check-updates');
        });
    }
}
