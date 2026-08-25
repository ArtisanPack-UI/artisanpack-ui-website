<?php

declare(strict_types=1);

namespace Modules\Privacy\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Top-level Privacy admin shell (issue #96.3). Renders the Keystone
 * Inertia/React chrome around four screens that consume the
 * artisanpack-ui/privacy package's JSON API:
 *
 *   - Consent manager        → GET /api/privacy/admin/consents
 *   - Data subject requests  → GET /api/privacy/admin/data-requests
 *   - Breach manager         → GET /api/privacy/admin/breaches
 *   - Compliance reports     → GET /api/privacy/admin/compliance-report
 *
 * The screens don't reimplement the package's services — they render
 * around the JSON API so the package remains the source of truth. Each
 * page ships an initial payload here (so the first paint is not blank)
 * and re-fetches on filter changes client-side.
 */
class PrivacyAdminController extends Controller
{
    public function consents(Request $request): Response
    {
        // One round trip for the whole tile row: bucketise on the
        // boolean column via SUM(CASE …) so total + granted come back
        // in a single row. `withdrawn` is derived from the two — no
        // second query needed.
        $counts = DB::table('privacy_consents')
            ->selectRaw('COUNT(*) AS total, SUM(CASE WHEN granted THEN 1 ELSE 0 END) AS granted')
            ->first();

        $total   = (int) ($counts->total ?? 0);
        $granted = (int) ($counts->granted ?? 0);

        return Inertia::render('admin/privacy/Consents', [
            'summary' => [
                'total'     => $total,
                'granted'   => $granted,
                'withdrawn' => $total - $granted,
            ],
        ]);
    }

    public function dataRequests(Request $request): Response
    {
        $counts = DB::table('privacy_data_requests')
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        return Inertia::render('admin/privacy/DataRequests', [
            'summary' => [
                'pending'    => (int) ($counts['pending'] ?? 0),
                'verified'   => (int) ($counts['verified'] ?? 0),
                'processing' => (int) ($counts['processing'] ?? 0),
                'completed'  => (int) ($counts['completed'] ?? 0),
                'rejected'   => (int) ($counts['rejected'] ?? 0),
            ],
        ]);
    }

    public function breaches(Request $request): Response
    {
        // One round trip: total + how many were reported to the
        // authority. `SUM(CASE …)` beats a second `COUNT(*)` filtered by
        // `whereNotNull` here — same table, same predicate work, half
        // the queries.
        $counts = DB::table('privacy_breach_notifications')
            ->selectRaw('COUNT(*) AS total, SUM(CASE WHEN authority_notified_at IS NOT NULL THEN 1 ELSE 0 END) AS notified')
            ->first();

        return Inertia::render('admin/privacy/Breaches', [
            'summary' => [
                'total'              => (int) ($counts->total ?? 0),
                'authority_notified' => (int) ($counts->notified ?? 0),
            ],
        ]);
    }

    public function reports(Request $request): Response
    {
        return Inertia::render('admin/privacy/Reports', [
            'periods' => [
                ['value' => 'day',     'label' => 'Last 24 hours'],
                ['value' => 'week',    'label' => 'Last 7 days'],
                ['value' => 'month',   'label' => 'Last 30 days'],
                ['value' => 'quarter', 'label' => 'Last 90 days'],
                ['value' => 'year',    'label' => 'Last 365 days'],
            ],
        ]);
    }
}
