<?php

declare(strict_types=1);

namespace Modules\Performance\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Top-level Performance admin shell (issue #98.4). Renders the Keystone
 * Inertia/React chrome around the operational surfaces that consume the
 * artisanpack-ui/performance package's JSON API:
 *
 *   - Overview / RUM dashboard   → GET /api/performance/admin/dashboard
 *   - Slow query log             → GET /api/performance/admin/queries
 *   - Index suggestions          → GET /api/performance/admin/recommendations
 *   - Cache management           → GET /api/performance/admin/cache
 *
 * The screens don't reimplement the package's services or duplicate its
 * aggregation SQL — every payload is served by the vendor's JSON API,
 * and these controllers just render the Inertia shell around it with
 * whatever metadata (range options, feature flags) the React screen
 * needs before its first fetch. Keeping the aggregation out of Keystone
 * avoids the two-source-of-truth drift a schema-duplicated summary
 * would introduce.
 *
 * AI panels (`QueryInsightPanel`, `OptimizationSuggestionPanel`) are
 * intentionally out of scope for this epic — they're tracked with the
 * eventual `artisanpack-ui/ai` integration effort.
 */
class PerformanceAdminController extends Controller
{
    /**
     * RUM date-range windows exposed to every range picker in the
     * Performance admin surface. Kept as a single class constant so
     * the Overview and Recommendations pages can't silently diverge on
     * which windows are available.
     *
     * @var list<array{value: string, label: string}>
     */
    private const RANGES = [
        ['value' => '24h', 'label' => 'Last 24 hours'],
        ['value' => '7d',  'label' => 'Last 7 days'],
        ['value' => '30d', 'label' => 'Last 30 days'],
        ['value' => '90d', 'label' => 'Last 90 days'],
    ];

    public function overview(Request $request): Response
    {
        return Inertia::render('admin/performance/Overview', [
            'ranges' => self::RANGES,
            'range'  => $this->normalizeRange($request->string('range', '7d')->toString()),
        ]);
    }

    public function slowQueries(Request $request): Response
    {
        return Inertia::render('admin/performance/SlowQueries', [
            'logging_enabled' => (bool) config('artisanpack.performance.database.slow_query_logging.enabled', false),
        ]);
    }

    public function indexSuggestions(Request $request): Response
    {
        return Inertia::render('admin/performance/IndexSuggestions', [
            'ranges' => self::RANGES,
        ]);
    }

    public function cacheManagement(Request $request): Response
    {
        return Inertia::render('admin/performance/CacheManagement', [
            'features' => [
                'page_cache'     => (bool) config('artisanpack.performance.features.page_cache', false),
                'fragment_cache' => (bool) config('artisanpack.performance.features.fragment_cache', false),
                'cache_warming'  => (bool) config('artisanpack.performance.features.cache_warming', false),
            ],
        ]);
    }

    /**
     * Whitelist the `?range=` query param against the ranges we render
     * in the picker. `Overview.tsx` forwards the value straight to the
     * vendor API, so a malformed deep link like
     * `?range=<script>alert(1)</script>` — or even just a benign
     * `?range=all` — would put the page into a permanent error state
     * on load. Falling back to the default keeps the page bootable
     * even when someone shares an out-of-date link.
     *
     * @since 1.0.0
     */
    private function normalizeRange(string $requested): string
    {
        foreach (self::RANGES as $range) {
            if ($range['value'] === $requested) {
                return $requested;
            }
        }

        return '7d';
    }
}
