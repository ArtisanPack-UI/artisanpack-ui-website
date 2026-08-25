<?php

declare(strict_types=1);

namespace Modules\SiteEditor\Widgets;

use Modules\Analytics\Services\KeystoneAnalytics;
use Modules\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface;
use Modules\Users\Models\User;

/**
 * Donut chart of traffic sources for the trailing 30 days.
 *
 * Data flows through {@see KeystoneAnalytics}, which already returns an
 * empty list when `KEYSTONE_ANALYTICS_ENABLED` is off, so the widget
 * does not need a parallel disabled branch — the React component
 * renders its own empty state for `sources: []`.
 */
class TrafficSourcesWidget implements KeystoneAdminWidgetInterface
{
    /**
     * @return array{title: string, description: string}
     */
    public static function getWidgetInfo(): array
    {
        return [
            'title'       => 'Traffic sources',
            'description' => 'Sessions by channel over the last 30 days.',
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     *
     * @return array{sources: list<array{source: string, visitors: int, percent: float}>}
     */
    public static function getData(User $user, array $options): array
    {
        return [
            'sources' => app(KeystoneAnalytics::class)->trafficSources(5),
        ];
    }

    /**
     * @return array{component: string, is_demo: bool}
     */
    public static function extendedInfo(): array
    {
        return [
            'component' => 'TrafficSourcesWidget',
            'is_demo'   => false,
        ];
    }
}
