<?php

declare(strict_types=1);

namespace App\SiteEditor\Widgets;

use App\Models\User;
use App\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface;
use App\Support\KeystoneSampleData;

/**
 * Single-KPI dashboard tile (revenue / orders / leads / sessions).
 *
 * One class powers all four variants via a `metric` option so users can drop
 * multiple instances onto a dashboard, each scoped to a different metric.
 * `getData()` returns a normalized KPI row sourced from `KeystoneSampleData`
 * until the per-metric backends land (see the parent feature issues per
 * metric in issue #82's table).
 *
 * `sessions` doesn't have a dedicated row in the sample-data KPIs, so the
 * value is summed from `trafficSources()`. The per-metric `delta` is held
 * here (rather than in sample data) because the real-data parents will
 * compute it from a period-over-period comparison.
 */
class KpiTileWidget implements KeystoneAdminWidgetInterface
{
    private const SUPPORTED_METRICS = ['revenue', 'orders', 'leads', 'sessions'];

    private const DEFAULT_METRIC = 'revenue';

    /**
     * Gating is intentionally left open until the per-metric real-data parents
     * land (see issue #82) — the framework treats null capability as "everyone
     * sees it", which is what the demo needs.
     *
     * @return array{title: string, description: string, default_options: array{metric: string}}
     */
    public static function getWidgetInfo(): array
    {
        return [
            'title'           => 'KPI tile',
            'description'     => 'Single-metric tile — revenue, orders, leads, or sessions.',
            'default_options' => [
                'metric' => self::DEFAULT_METRIC,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     *
     * @return array{metric: string, kpi: array{label: string, value: float|int, format: string, delta: float, delta_label: string}}
     */
    public static function getData(User $user, array $options): array
    {
        $metric = self::resolveMetric($options);

        return [
            'metric' => $metric,
            'kpi'    => self::kpiFor($metric),
        ];
    }

    /**
     * @return array{component: string, is_demo: bool, settings_schema: array{fields: list<array{name: string, label: string, type: string, default: string, options: list<array{value: string, label: string}>}>}}
     */
    public static function extendedInfo(): array
    {
        return [
            'component'       => 'KpiTileWidget',
            'is_demo'         => true,
            'settings_schema' => [
                'fields' => [
                    [
                        'name'    => 'metric',
                        'label'   => 'Metric',
                        'type'    => 'select',
                        'default' => self::DEFAULT_METRIC,
                        'options' => [
                            ['value' => 'revenue', 'label' => 'Revenue (30d)'],
                            ['value' => 'orders', 'label' => 'Orders (30d)'],
                            ['value' => 'leads', 'label' => 'New leads (30d)'],
                            ['value' => 'sessions', 'label' => 'Sessions (30d)'],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array{label: string, value: float|int, format: string, delta: float, delta_label: string}
     */
    private static function kpiFor(string $metric): array
    {
        if ('sessions' === $metric) {
            $visitors = array_sum(array_column(KeystoneSampleData::trafficSources(), 'visitors'));

            return [
                'label'       => 'Sessions (30d)',
                'value'       => $visitors,
                'format'      => 'number',
                'delta'       => 12.4,
                'delta_label' => 'vs prev 30d',
            ];
        }

        $sampleIndex = [
            'revenue' => 0,
            'orders'  => 1,
            'leads'   => 2,
        ];

        $kpis = KeystoneSampleData::kpis();

        return $kpis[$sampleIndex[$metric]];
    }

    /**
     * @param  array<string, mixed>  $options
     */
    private static function resolveMetric(array $options): string
    {
        $candidate = $options['metric'] ?? null;

        if (is_string($candidate) && in_array($candidate, self::SUPPORTED_METRICS, true)) {
            return $candidate;
        }

        return self::DEFAULT_METRIC;
    }
}
