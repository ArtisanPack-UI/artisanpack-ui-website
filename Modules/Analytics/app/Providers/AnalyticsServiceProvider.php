<?php

declare(strict_types=1);

namespace Modules\Analytics\Providers;

use App\Providers\KeystoneModuleServiceProvider;

/**
 * Boots the Analytics module.
 *
 * Unlike Performance and Privacy, Analytics never had a dedicated
 * provider in `app/Providers` — the `artisanpack-ui/analytics` package
 * registers its own bindings (including the `AnalyticsQuery` that
 * {@see \Modules\Analytics\Services\KeystoneAnalytics} wraps) and owns
 * its own schedule, so there was nothing in `AppServiceProvider` to
 * absorb. This provider therefore exists to do exactly two things, both
 * inherited from {@see \Nwidart\Modules\Support\ModuleServiceProvider}:
 * register the module's `RouteServiceProvider`, and load the twelve
 * `analytics_*` migrations
 * that moved into `database/migrations` with the module.
 *
 * `KeystoneAnalytics` itself needs no binding — it is a concrete class
 * with a single constructor dependency the container already resolves.
 *
 * The Keystone-level on/off switch stays where it was: the
 * `features.analytics` flag in `config/keystone.php`, enforced by
 * `EnsureFeatureIsEnabled` on the module's route and re-checked inside
 * `KeystoneAnalytics::enabled()` for the dashboard widgets that call it
 * outside any request gated by that middleware.
 */
class AnalyticsServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Analytics';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'analytics';

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        RouteServiceProvider::class,
    ];
}
