<?php

declare(strict_types=1);

namespace App\Providers;

use ArtisanPackUI\CMSFramework\Modules\Core\Updates\Enums\UpdateType;
use ArtisanPackUI\CMSFramework\Modules\Core\Updates\Managers\ApplicationUpdateManager;
use ArtisanPackUI\CMSFramework\Modules\Core\Updates\UpdateCheckerFactory;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\ServiceProvider;

/**
 * Wires the cms-framework Updates module against Keystone's GitLab source.
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
 */
class UpdatesServiceProvider extends ServiceProvider
{
    public function register(): void
    {
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

        $this->registerSchedule();
    }

    /**
     * Register the daily update-check cron entry.
     *
     * Runs the framework's `update:check-scheduled` (which writes the
     * `cms.update_available` cache key consumed by the Dashboard banner)
     * once per day in production. `runInBackground()` keeps a slow GitLab
     * round-trip from delaying other scheduled jobs in the same minute.
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
