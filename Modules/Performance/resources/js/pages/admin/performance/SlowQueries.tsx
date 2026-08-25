/* eslint-disable react-hooks/set-state-in-effect -- Classic
   fetch-on-mount / filter-change pattern; the cascading render from
   loading→loaded is intentional. */

import { useEffect, useState, type ReactElement } from 'react';
import { Head } from '@inertiajs/react';
import PerformanceAdminLayout from '../../../layouts/PerformanceAdminLayout';
import { Card, PageHeader } from '@/components/admin/keystone';
import { performanceApi } from '@/lib/vendor/performance-endpoints';

interface SlowQueriesPageProps {
    logging_enabled: boolean;
}

/**
 * Shape of the vendor's `/admin/queries` response. Kept as-is from the
 * package so a version bump surfaces here as a type error rather than
 * a silent render change.
 */
interface QueriesPayload {
    rows: Array<{
        hash: string;
        query: string;
        normalized: string;
        peak_time_ms: number;
        avg_time_ms: number;
        occurrences: number;
        route: string | null;
        file: string | null;
        line: number | null;
        last_seen: string;
        suggestion: string | null;
    }>;
    available_routes: string[];
    sort: string;
}

function formatMs(value: number): string {
    return `${value.toFixed(1)} ms`;
}

export default function SlowQueries({ logging_enabled }: SlowQueriesPageProps): ReactElement {
    const [payload, setPayload] = useState<QueriesPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [route, setRoute] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        // Clear the previous payload so a failed filter change doesn't
        // leave the last route's rows rendered under an error alert.
        setPayload(null);

        const params = new URLSearchParams();
        if (route !== '') {
            params.set('route', route);
        }

        fetch(`${performanceApi.admin.queries()}?${params.toString()}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then((body) => setPayload(body as QueriesPayload))
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
    }, [route]);

    const rows = payload?.rows ?? [];
    const availableRoutes = payload?.available_routes ?? [];

    return (
        <PerformanceAdminLayout>
            <Head title="Slow Queries" />

            <PageHeader
                title="Slow Queries"
                description="Recent slow queries captured by the perf package's slow query logger."
            />

            {!logging_enabled && (
                <div className="alert alert-warning mb-4">
                    Slow query logging is disabled. Enable it under Settings → Performance
                    to start capturing samples. The screen will render empty until then.
                </div>
            )}

            <Card>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-base-content/60">Route:</span>
                    <select
                        value={route}
                        onChange={(event) => setRoute(event.target.value)}
                        className="select select-sm select-bordered"
                    >
                        <option value="">All routes</option>
                        {availableRoutes.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>

                {error && <div className="alert alert-error mb-4">Failed to load samples: {error}</div>}

                {loading && <div className="text-center text-base-content/60">Loading…</div>}

                {!loading && !error && rows.length === 0 && (
                    <div className="rounded-lg bg-base-200 p-6 text-center text-base-content/60">
                        No slow queries recorded.
                    </div>
                )}

                {!loading && rows.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Peak</th>
                                    <th>Avg</th>
                                    <th>Occurrences</th>
                                    <th>Route</th>
                                    <th>Last seen</th>
                                    <th>Query</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.hash}>
                                        <td>{formatMs(row.peak_time_ms)}</td>
                                        <td>{formatMs(row.avg_time_ms)}</td>
                                        <td>{row.occurrences.toLocaleString()}</td>
                                        <td className="whitespace-nowrap">
                                            {row.route ? <code className="text-xs">{row.route}</code> : '—'}
                                        </td>
                                        <td className="whitespace-nowrap">{row.last_seen}</td>
                                        <td>
                                            <code className="text-xs">{row.query}</code>
                                            {row.suggestion && (
                                                <div className="mt-1 text-xs text-base-content/60">
                                                    Suggestion: {row.suggestion}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </PerformanceAdminLayout>
    );
}
