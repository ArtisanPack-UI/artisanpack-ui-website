<?php

declare(strict_types=1);

namespace App\SiteEditor\Widgets;

use App\Models\User;
use App\Services\KeystoneAnalytics;
use App\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface;

/**
 * 30-day visitor trend area chart for the admin dashboard.
 *
 * Pulls daily visitor counts from {@see KeystoneAnalytics}, which always
 * returns 30 buckets even when the provider has gaps so the chart line
 * stays continuous. The series shape matches what the React component
 * hands straight to ApexCharts.
 */
class VisitorsTrendWidget implements KeystoneAdminWidgetInterface
{
    /**
     * @return array{title: string, description: string}
     */
    public static function getWidgetInfo(): array
    {
        return [
            'title'       => 'Visitor trend',
            'description' => 'Daily unique visitors over the last 30 days.',
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     *
     * @return array{series: array{categories: list<string>, series: list<array{name: string, data: list<int>}>}}
     */
    public static function getData(User $user, array $options): array
    {
        return [
            'series' => app(KeystoneAnalytics::class)->thirtyDayVisitorTrend(),
        ];
    }

    /**
     * @return array{component: string, is_demo: bool}
     */
    public static function extendedInfo(): array
    {
        return [
            'component' => 'VisitorsTrendWidget',
            'is_demo'   => false,
        ];
    }
}
