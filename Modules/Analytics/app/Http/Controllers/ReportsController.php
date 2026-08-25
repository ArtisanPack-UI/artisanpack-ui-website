<?php

declare(strict_types=1);

namespace Modules\Analytics\Http\Controllers;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;
use Modules\Analytics\Services\KeystoneAnalytics;
use Modules\Installer\Support\KeystoneSampleData;

/**
 * Renders the `/admin/reports` screen.
 *
 * Extracted verbatim from `KeystoneShellController::reports()` — that
 * controller is the commerce placeholder shell and stays central
 * (plans/14-modular-laravel-setup.md §3.5), but the Reports action was
 * the one action in it backed by real analytics data, so it moves here
 * with the rest of the module. The route name `admin.reports` and the
 * Inertia page key `admin/Reports` are unchanged.
 */
class ReportsController extends Controller
{
    /**
     * Render the Reports page with live data from `artisanpack-ui/analytics`.
     *
     * The `revenue_series` prop stays sample-backed until the commerce
     * wiring lands in issue #28 — revenue is not an analytics metric.
     * KPIs, top pages, and traffic sources all flow through
     * {@see KeystoneAnalytics}, which already returns empty/zero shapes
     * when no data exists so the React page never has to special-case it.
     */
    public function index(KeystoneAnalytics $analytics): Response
    {
        return Inertia::render('admin/Reports', [
            'kpis'            => $analytics->reportKpis(),
            'revenue_series'  => KeystoneSampleData::revenueSeries(),
            'top_pages'       => $analytics->topPages(),
            'traffic_sources' => $analytics->trafficSources(),
        ]);
    }
}
