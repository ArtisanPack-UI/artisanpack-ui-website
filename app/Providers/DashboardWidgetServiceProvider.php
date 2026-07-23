<?php

declare(strict_types=1);

namespace App\Providers;

use ArtisanPackUI\CMSFramework\Modules\AdminWidgets\Services\AdminWidgetManager;
use Illuminate\Support\ServiceProvider;

/**
 * Registers Keystone's built-in admin dashboard widgets with the framework's
 * AdminWidgetManager.
 *
 * Plugin packages should register their own widgets in their own providers
 * rather than appending here — this provider stays scoped to first-party
 * Keystone widgets so plugin uninstall stays a clean operation.
 *
 * The concrete widget classes ship in subsequent sub-issues of #71. This
 * provider intentionally registers nothing until those classes land; the
 * `widgets` map below is the single point of edit for the port-mockup
 * sub-issue.
 */
class DashboardWidgetServiceProvider extends ServiceProvider
{
    /**
     * Map of `type` => fully-qualified widget class. Keystone widgets must
     * implement `App\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface`;
     * the framework's `AdminWidgetManager::register()` silently ignores any
     * class that doesn't satisfy `AdminWidgetInterface`, so a stale entry here
     * surfaces as a missing widget on the dashboard rather than a boot crash.
     *
     * @var array<string, class-string>
     */
    protected array $widgets = [
        'keystone.welcome'           => \App\SiteEditor\Widgets\WelcomeWidget::class,
        'keystone.update-banner'     => \App\SiteEditor\Widgets\UpdateBannerWidget::class,
        'keystone.site-at-a-glance'  => \App\SiteEditor\Widgets\SiteAtAGlanceWidget::class,
        'keystone.recent-activity'   => \App\SiteEditor\Widgets\RecentActivityWidget::class,
        'keystone.kpi-tile'          => \App\SiteEditor\Widgets\KpiTileWidget::class,
        'keystone.revenue-trend'     => \App\SiteEditor\Widgets\RevenueTrendWidget::class,
        'keystone.visitors-trend'    => \App\SiteEditor\Widgets\VisitorsTrendWidget::class,
        'keystone.traffic-sources'   => \App\SiteEditor\Widgets\TrafficSourcesWidget::class,
        'keystone.recent-orders'     => \App\SiteEditor\Widgets\RecentOrdersWidget::class,
        'keystone.recent-leads'      => \App\SiteEditor\Widgets\RecentLeadsWidget::class,
        'keystone.order-status'      => \App\SiteEditor\Widgets\OrderStatusWidget::class,
        'keystone.lead-funnel'       => \App\SiteEditor\Widgets\LeadFunnelWidget::class,
        'keystone.inventory-alerts'  => \App\SiteEditor\Widgets\InventoryAlertsWidget::class,
    ];

    public function boot(AdminWidgetManager $widgets): void
    {
        foreach ($this->widgets as $type => $class) {
            $widgets->register($type, $class);
        }
    }
}
