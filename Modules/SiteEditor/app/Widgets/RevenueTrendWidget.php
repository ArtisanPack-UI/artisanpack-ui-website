<?php

declare(strict_types=1);

namespace Modules\SiteEditor\Widgets;

use Modules\Installer\Support\KeystoneSampleData;
use Modules\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface;
use Modules\Users\Models\User;

/**
 * Daily revenue area chart, current vs previous period.
 *
 * Demo-data backed until the analytics wiring lands in issue #27. The
 * underlying series shape mirrors what an ApexCharts area chart consumes so
 * the React component can hand it straight through without remapping.
 */
class RevenueTrendWidget implements KeystoneAdminWidgetInterface
{
    /**
     * Capability stays null until the analytics backend in #27 lands and
     * registers a `commerce.view` (or similar) permission slug.
     *
     * @return array{title: string, description: string}
     */
    public static function getWidgetInfo(): array
    {
        return [
            'title'       => 'Revenue trend',
            'description' => 'Daily revenue vs the previous period (last 30 days).',
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     *
     * @return array{series: array{categories: list<string>, series: list<array{name: string, data: list<float|int>}>}}
     */
    public static function getData(User $user, array $options): array
    {
        return [
            'series' => KeystoneSampleData::revenueSeries(),
        ];
    }

    /**
     * @return array{component: string, is_demo: bool}
     */
    public static function extendedInfo(): array
    {
        return [
            'component' => 'RevenueTrendWidget',
            'is_demo'   => true,
        ];
    }
}
