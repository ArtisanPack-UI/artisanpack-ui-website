<?php

declare(strict_types=1);

namespace App\Services;

use ArtisanPackUI\Analytics\Data\DateRange;
use ArtisanPackUI\Analytics\Services\AnalyticsQuery;
use Illuminate\Support\Carbon;

/**
 * Keystone-facing facade over the `artisanpack-ui/analytics` package.
 *
 * Centralises the `KEYSTONE_ANALYTICS_ENABLED` gate so admin pages and
 * dashboard widgets can ask for analytics data without having to know
 * whether the package is wired up. When the feature flag is off, every
 * accessor returns the same empty/zero shape the React side renders, so
 * UI components don't need a parallel "disabled" branch.
 *
 * The underlying `AnalyticsQuery` already memoises results for
 * `artisanpack.analytics.dashboard.cache_duration` seconds, so callers
 * may invoke these helpers freely on every request.
 */
class KeystoneAnalytics
{
    public function __construct(private readonly AnalyticsQuery $query) {}

    /**
     * Whether the Keystone-level analytics feature is enabled. The route
     * `feature:analytics` middleware enforces this server-side; the React
     * shell also hides the Reports nav item when this is false.
     */
    public function enabled(): bool
    {
        return (bool) keystone('features.analytics', false);
    }

    /**
     * Daily visitor counts for the trailing 30 days, including today, in the
     * `categories`/`series` shape ApexCharts consumes directly. The chart
     * always renders 30 buckets even when the provider has no rows for a
     * given day, so the line doesn't visually collapse on quiet days.
     *
     * @return array{categories: list<string>, series: list<array{name: string, data: list<int>}>}
     */
    public function thirtyDayVisitorTrend(): array
    {
        $end   = Carbon::today();
        $start = $end->copy()->subDays(29);
        $range = new DateRange(startDate: $start, endDate: $end->copy()->endOfDay());

        $rows = $this->enabled()
            ? $this->query->getPageViews($range, 'day')->keyBy('date')
            : collect();

        $categories = [];
        $visitors   = [];

        for ($cursor = $start->copy(); $cursor->lte($end); $cursor->addDay()) {
            $key          = $cursor->format('Y-m-d');
            $categories[] = $cursor->format('M j');
            $visitors[]   = (int) ($rows->get($key)['visitors'] ?? 0);
        }

        return [
            'categories' => $categories,
            'series'     => [
                ['name' => 'Visitors', 'data' => $visitors],
            ],
        ];
    }

    /**
     * Headline KPIs for the Reports page over the trailing 30 days, with a
     * percentage delta vs. the prior 30 days. Deltas are zero when the
     * prior period had no traffic (avoids a divide-by-zero spike on
     * brand-new installs).
     *
     * @return list<array{label: string, value: float|int, format: 'number', delta: float, delta_label: string}>
     */
    public function reportKpis(): array
    {
        $currentEnd = Carbon::now();
        $current    = new DateRange(startDate: $currentEnd->copy()->subDays(29)->startOfDay(), endDate: $currentEnd);
        $previous   = new DateRange(startDate: $currentEnd->copy()->subDays(59)->startOfDay(), endDate: $currentEnd->copy()->subDays(30)->endOfDay());

        if (! $this->enabled()) {
            return [
                $this->emptyKpi('Page views (30d)'),
                $this->emptyKpi('Visitors (30d)'),
                $this->emptyKpi('Sessions (30d)'),
                $this->emptyKpi('Bounce rate (30d)'),
            ];
        }

        $pageViews    = $this->query->getPageViewCount($current);
        $visitors     = $this->query->getVisitors($current);
        $sessions     = $this->query->getSessions($current);
        $bounceRate   = $this->query->getBounceRate($current);

        $prevPageViews  = $this->query->getPageViewCount($previous);
        $prevVisitors   = $this->query->getVisitors($previous);
        $prevSessions   = $this->query->getSessions($previous);
        $prevBounceRate = $this->query->getBounceRate($previous);

        return [
            $this->kpi('Page views (30d)', $pageViews, $this->delta($pageViews, $prevPageViews)),
            $this->kpi('Visitors (30d)', $visitors, $this->delta($visitors, $prevVisitors)),
            $this->kpi('Sessions (30d)', $sessions, $this->delta($sessions, $prevSessions)),
            $this->kpi('Bounce rate (30d)', round($bounceRate, 1), $this->delta($bounceRate, $prevBounceRate)),
        ];
    }

    /**
     * Top 10 most-viewed pages over the trailing 30 days.
     *
     * @return list<array{path: string, title: string, views: int, unique_views: int}>
     */
    public function topPages(int $limit = 10): array
    {
        if (! $this->enabled()) {
            return [];
        }

        return $this->query->getTopPages($this->lastThirtyDays(), $limit)->values()->all();
    }

    /**
     * Traffic source breakdown over the trailing 30 days, normalised to the
     * `{source, visitors, percent}` shape both the Reports bar chart and
     * the dashboard donut widget consume. Percent is precomputed off the
     * sum of returned rows (not the global session total) so the slice
     * percentages add up to 100 within the widget.
     *
     * @return list<array{source: string, visitors: int, percent: float}>
     */
    public function trafficSources(int $limit = 10): array
    {
        if (! $this->enabled()) {
            return [];
        }

        $rows  = $this->query->getTrafficSources($this->lastThirtyDays(), $limit);
        $total = (int) $rows->sum('visitors');

        return $rows->map(fn (array $row): array => [
            'source'   => (string) ($row['source'] ?? 'direct'),
            'visitors' => (int) ($row['visitors'] ?? 0),
            'percent'  => $total > 0 ? round(((int) ($row['visitors'] ?? 0) / $total) * 100, 1) : 0.0,
        ])->values()->all();
    }

    private function lastThirtyDays(): DateRange
    {
        return DateRange::lastDays(30);
    }

    /**
     * @return array{label: string, value: float|int, format: 'number', delta: float, delta_label: string}
     */
    private function kpi(string $label, int|float $value, float $delta): array
    {
        return [
            'label'       => $label,
            'value'       => $value,
            'format'      => 'number',
            'delta'       => $delta,
            'delta_label' => 'vs prev 30d',
        ];
    }

    /**
     * @return array{label: string, value: float|int, format: 'number', delta: float, delta_label: string}
     */
    private function emptyKpi(string $label): array
    {
        return $this->kpi($label, 0, 0.0);
    }

    private function delta(float|int $current, float|int $previous): float
    {
        if ($previous <= 0) {
            return 0.0;
        }

        return round((($current - $previous) / $previous) * 100, 1);
    }
}
