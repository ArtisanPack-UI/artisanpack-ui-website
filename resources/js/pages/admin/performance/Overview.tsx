/* eslint-disable react-hooks/set-state-in-effect -- Classic
   fetch-on-mount / filter-change pattern; the cascading render from
   loading→loaded is intentional. */

import { useEffect, useState, type ReactElement } from 'react';
import { Head } from '@inertiajs/react';
import PerformanceAdminLayout from '@/layouts/PerformanceAdminLayout';
import { Card, KpiTile, PageHeader, StatusBadge, type Tone } from '@/components/admin/keystone';
import { performanceApi } from '@/lib/vendor/performance-endpoints';

interface RangeOption {
    value: string;
    label: string;
}

interface OverviewPageProps {
    ranges: RangeOption[];
    range: string;
}

/**
 * Shape of the vendor's `/admin/dashboard` response. Kept as-is from the
 * package so a version bump surfaces here as a type error rather than
 * a silent render change.
 */
interface DashboardPayload {
    range: string;
    overview: Array<{
        metric: string;
        p75: number | null;
        sample_count: number;
        status: 'good' | 'needs_improvement' | 'poor' | 'unknown';
    }>;
    pages: Array<{
        route: string;
        metric: string;
        p75: number | null;
        sample_count: number;
    }>;
    cache: {
        page: { entries: number };
        fragment: { entries: number; tags: number };
    };
}

function formatMetricValue(metric: string, value: number | null): string {
    if (value === null || Number.isNaN(value)) {
        return '—';
    }
    // CLS is unitless and small; the rest are milliseconds.
    if (metric === 'CLS') {
        return value.toFixed(3);
    }
    return `${Math.round(value)} ms`;
}

function toneForStatus(status: DashboardPayload['overview'][number]['status']): Tone {
    switch (status) {
        case 'good':
            return 'success';
        case 'needs_improvement':
            return 'warning';
        case 'poor':
            return 'error';
        default:
            return 'neutral';
    }
}

export default function Overview({ ranges, range: initialRange }: OverviewPageProps): ReactElement {
    const [range, setRange] = useState(initialRange);
    const [payload, setPayload] = useState<DashboardPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Abort the in-flight request whenever the range flips so a
        // slower "90d" query can't overwrite the fresher "24h" response.
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        // Clear the previous payload so a failed range change doesn't
        // leave the last range's metrics rendered under an error alert
        // — otherwise users read the "7d" numbers as if they described
        // the "90d" window they just requested.
        setPayload(null);

        fetch(`${performanceApi.admin.dashboard()}?range=${encodeURIComponent(range)}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then((body) => setPayload(body as DashboardPayload))
            .catch((err: Error) => {
                if ('AbortError' !== err.name) {
                    setError(err.message);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [range]);

    const overview = payload?.overview ?? [];
    const pages    = payload?.pages ?? [];
    const cache    = payload?.cache;

    return (
        <PerformanceAdminLayout>
            <Head title="Performance Overview" />

            <PageHeader
                title="Performance Overview"
                description="Real-user Web Vitals aggregated from the perf package's on-page collector."
            />

            <Card>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-base-content/60">Range:</span>
                    {ranges.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setRange(option.value)}
                            aria-pressed={range === option.value}
                            className={`btn btn-sm ${range === option.value ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {error && <div className="alert alert-error mb-4">Failed to load dashboard: {error}</div>}

                {loading && <div className="text-center text-base-content/60">Loading…</div>}

                {!loading && !error && overview.length === 0 && (
                    <div className="rounded-lg bg-base-200 p-6 text-center text-base-content/60">
                        No samples yet. The collector is auto-injected on every public HTML
                        response; check back after visitors browse the site.
                    </div>
                )}

                {!loading && overview.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        {overview.map((entry) => (
                            <div key={entry.metric} className="rounded-lg bg-base-100 p-4 shadow">
                                <div className="flex items-baseline justify-between">
                                    <KpiTile
                                        label={`${entry.metric} p75`}
                                        value={formatMetricValue(entry.metric, entry.p75)}
                                    />
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs text-base-content/60">
                                    <span>{entry.sample_count.toLocaleString()} samples</span>
                                    <StatusBadge
                                        status={entry.status}
                                        label={entry.status.replace('_', ' ')}
                                        tone={toneForStatus(entry.status)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {!loading && pages.length > 0 && (
                <Card>
                    <h3 className="mb-3 text-base font-semibold">Slowest routes</h3>
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Route</th>
                                    <th>Metric</th>
                                    <th>p75</th>
                                    <th>Samples</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pages.map((row, index) => (
                                    <tr key={`${row.route}-${row.metric}-${index}`}>
                                        <td>
                                            <code className="text-xs">{row.route}</code>
                                        </td>
                                        <td>{row.metric}</td>
                                        <td>{formatMetricValue(row.metric, row.p75)}</td>
                                        <td>{row.sample_count.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {!loading && cache && (
                <Card>
                    <h3 className="mb-3 text-base font-semibold">Cache footprint</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <KpiTile label="Page cache entries" value={cache.page.entries.toLocaleString()} />
                        <KpiTile label="Fragment cache entries" value={cache.fragment.entries.toLocaleString()} />
                        <KpiTile label="Fragment tags" value={cache.fragment.tags.toLocaleString()} />
                    </div>
                </Card>
            )}
        </PerformanceAdminLayout>
    );
}
