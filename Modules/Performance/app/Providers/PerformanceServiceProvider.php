<?php

declare(strict_types=1);

namespace Modules\Performance\Providers;

use App\Jobs\PurgeCloudflareCacheJob;
use App\Providers\KeystoneModuleServiceProvider;
use App\Support\SettingsPanels;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Modules\Performance\Http\Controllers\Settings\PerformanceController;
use Modules\Users\Models\User;
use Throwable;

/**
 * Wires the artisanpack-ui/performance package into Keystone.
 *
 * Responsibilities:
 *
 *   1. Tie the two `monitoring` config knobs the vendor exposes
 *      together. The vendor's `@perfMonitor` Blade directive gates
 *      on `artisanpack.performance.monitoring.enabled` (a hardcoded
 *      true in the shipped config), while the Settings → Performance
 *      toggle writes `artisanpack.performance.features.monitoring`
 *      via `PERF_MONITORING`. Mirroring one into the other in
 *      `register()` makes the admin toggle actually disable RUM
 *      collection — otherwise an admin flipping monitoring off in
 *      the UI would keep injecting beacons on every page.
 *
 *   2. Register the recurring optimization/aggregation commands. The
 *      package auto-registers no schedule of its own, so every
 *      recurring run is owned here — one place to audit the full
 *      performance cadence for a Keystone install.
 *
 *   3. Register the `view-performance-dashboard` gate against the
 *      `performance.view` permission slug (seeded by
 *      `KeystonePermissionsSeeder`). This matches the pattern used
 *      elsewhere in the admin (`updater.run`) so operators can
 *      redistribute performance access to a custom role without
 *      forking Keystone.
 *
 *   4. Claim the Performance tab of `/admin/settings` through the
 *      `keystone.admin.settings.panels` filter ({@see SettingsPanels}),
 *      so core never names a Performance class to render it.
 *
 *   5. Bridge the perf package's `CachePurged` event into Keystone's
 *      edge-cache purge job (see #20). Only fragment-cache tag
 *      invalidations are forwarded — page-cache pattern flushes and
 *      full flushes have no clean semantic mapping onto Cloudflare's
 *      tag-purge API and are left to the job (#20) to handle
 *      directly. The bridge is a no-op when `PurgeCloudflareCacheJob`
 *      is not present (its landing is tracked by #20, which is not
 *      blocked by this epic).
 *
 * Commands wired:
 *   - `perf:aggregate-metrics` — hourly, aggregates RUM samples into
 *     the per-day percentile summaries the dashboard reads.
 *   - `perf:warm-cache` — daily at 02:00, issues concurrent requests
 *     to the routes/URLs listed in `performance.cache_warming.urls`
 *     so the first visitor after a deploy is not the one paying for
 *     a cold page-cache miss.
 *   - `perf:critical-css` — nightly at 03:30, refreshes the extracted
 *     critical CSS for every route in `performance.css.critical.sources`.
 *   - `perf:generate-webp` — nightly at 04:15, backfills WebP
 *     variants for any media that was uploaded before
 *     image_optimization was enabled or missed the on-upload
 *     conversion.
 *
 * All commands are `->onOneServer()` so a horizontally scaled deploy
 * doesn't run the same aggregation N times.
 */
class PerformanceServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Performance';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'performance';

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

        // Tie `monitoring.enabled` to `features.monitoring` so the
        // Settings → Performance toggle (which writes `PERF_MONITORING`
        // via `Http\Controllers\Settings\PerformanceController`) actually
        // gates the vendor `@perfMonitor` Blade directive. The vendor
        // config ships `monitoring.enabled = true` with no env variable,
        // so without this tie the admin toggle looks like it does nothing.
        //
        // Runs at register() so the tie is in place before any request
        // handler consults the directive. Env-driven `features.monitoring`
        // was already loaded by Laravel's config bootstrap by the time
        // this provider registers.
        config()->set(
            'artisanpack.performance.monitoring.enabled',
            (bool) config('artisanpack.performance.features.monitoring', false),
        );
    }

    public function boot(): void
    {
        parent::boot();

        $this->registerDashboardGate();
        $this->wireFragmentInvalidationToEdgePurge();
        $this->registerSettingsPanel();
    }

    /**
     * Claim the `performance` tab of `/admin/settings`.
     *
     * The panel payload is the module's to produce, so the module registers
     * it rather than core reaching into
     * {@see PerformanceController::payload()} by name (#235). The closure
     * runs only when `/admin/settings` emits the filter.
     *
     * `??=` because the filter contract is first-claim-wins — see
     * {@see SettingsPanels} for the full ordering and collision rules.
     */
    protected function registerSettingsPanel(): void
    {
        if (! function_exists('addFilter')) {
            return;
        }

        addFilter(SettingsPanels::FILTER, static function (mixed $panels): mixed {
            if (! is_array($panels)) {
                return $panels;
            }

            $panels['performance'] ??= PerformanceController::payload();

            return $panels;
        });
    }

    /**
     * Register the recurring performance commands.
     *
     * This is nwidart's per-module schedule hook —
     * {@see \Nwidart\Modules\Support\ModuleServiceProvider} calls it once the
     * application has booted, so the module doesn't
     * hand-roll its own `callAfterResolving(Schedule::class)`.
     */
    protected function configureSchedules(Schedule $schedule): void
    {
        $schedule->command('perf:aggregate-metrics')
            ->hourly()
            ->onOneServer()
            ->name('keystone:perf-aggregate-metrics');

        $schedule->command('perf:warm-cache')
            ->dailyAt('02:00')
            ->onOneServer()
            ->name('keystone:perf-warm-cache');

        $schedule->command('perf:critical-css')
            ->dailyAt('03:30')
            ->onOneServer()
            ->name('keystone:perf-critical-css');

        $schedule->command('perf:generate-webp')
            ->dailyAt('04:15')
            ->onOneServer()
            ->name('keystone:perf-generate-webp');
    }

    /**
     * Register the gate the perf package's admin JSON API authorizes
     * against (`view-performance-dashboard`).
     *
     * Checks the `performance.view` permission slug seeded by
     * `KeystonePermissionsSeeder` — mirroring `updater.run` in the
     * updater surface. Operators can grant a custom role
     * `performance.view` without touching Keystone's role hierarchy,
     * and admin/site_owner get it by default via the seeder.
     *
     * The closure typehints `User $user` (non-nullable) so Laravel's
     * Gate framework short-circuits to false for unauthenticated
     * requests rather than passing null into `hasPermissionTo()`.
     */
    private function registerDashboardGate(): void
    {
        Gate::define('view-performance-dashboard', static function (User $user): bool {
            return $user->hasPermissionTo('performance.view');
        });
    }

    /**
     * Wire the perf package's `CachePurged` event into the Cloudflare
     * cache-tag purge job.
     *
     * The perf package's cache layers (`FragmentCache`, `PageCacheManager`)
     * dispatch `ArtisanPackUI\Performance\Events\CachePurged($keys,
     * $reason)` after every invalidation. The `$reason` string encodes
     * the invalidation category — this bridge only forwards
     * `fragment-cache:tag:{$tag}` events onto the Cloudflare purge job,
     * matching cache tag against cache tag. Full page-cache flushes and
     * pattern invalidations don't map cleanly onto Cloudflare's
     * tag-purge API and are left for the purge job itself to interpret
     * once it lands (#20).
     *
     * When the purge job class isn't loaded yet (its landing is tracked
     * separately in #20), the listener registration is skipped so this
     * provider stays a no-op instead of a class-not-found on boot.
     */
    private function wireFragmentInvalidationToEdgePurge(): void
    {
        if (! class_exists(PurgeCloudflareCacheJob::class)) {
            return;
        }

        $eventClass = '\ArtisanPackUI\Performance\Events\CachePurged';

        if (! class_exists($eventClass)) {
            return;
        }

        $events = $this->app->make(Dispatcher::class);

        $events->listen($eventClass, static function (object $event): void {
            $reason = property_exists($event, 'reason') ? (string) $event->reason : '';
            $prefix = 'fragment-cache:tag:';

            if (! str_starts_with($reason, $prefix)) {
                return;
            }

            $tag = substr($reason, strlen($prefix));

            if ('' === $tag) {
                return;
            }

            try {
                PurgeCloudflareCacheJob::dispatch([$tag]);
            } catch (Throwable $e) {
                // Never let an edge-purge failure block the origin-side
                // invalidation from succeeding. Log so operators can see
                // the mismatch in Grafana / logs, but let the fragment
                // cache continue to drop locally.
                Log::warning('keystone: perf fragment invalidation → Cloudflare purge failed', [
                    'tag'   => $tag,
                    'error' => $e->getMessage(),
                ]);
            }
        });
    }
}
