/* eslint-disable react-hooks/set-state-in-effect -- Classic
   fetch-on-mount pattern; the cascading render from loading→loaded is
   intentional. */

import { useEffect, useState, type ReactElement } from 'react';
import { Head } from '@inertiajs/react';
import PerformanceAdminLayout from '@/layouts/PerformanceAdminLayout';
import { Card, PageHeader } from '@/components/admin/keystone';
import { performanceApi } from '@/lib/vendor/performance-endpoints';

interface RangeOption {
    value: string;
    label: string;
}

interface IndexSuggestionsPageProps {
    ranges: RangeOption[];
}

/**
 * Shape of the vendor's `/admin/recommendations` response. The perf
 * package's `RecommendationEngine` covers a wider set than just
 * "add-this-index" — it also surfaces slow-page + cache-miss items —
 * so the type is loose enough to cover the whole set.
 */
interface RecommendationsPayload {
    items: Array<{
        id: string;
        type: string;
        title: string;
        detail?: string;
        severity?: 'info' | 'warning' | 'error';
        [key: string]: unknown;
    }>;
    dismissed: string[];
}

export default function IndexSuggestions({ ranges }: IndexSuggestionsPageProps): ReactElement {
    const [range, setRange] = useState('7d');
    const [payload, setPayload] = useState<RecommendationsPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        // Clear the previous payload so a failed range change doesn't
        // leave the last range's recommendations rendered under an
        // error alert — otherwise users read stale items as if they
        // described the range they just requested.
        setPayload(null);

        fetch(`${performanceApi.admin.recommendations()}?range=${encodeURIComponent(range)}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then((body) => setPayload(body as RecommendationsPayload))
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

    const items = payload?.items ?? [];

    return (
        <PerformanceAdminLayout>
            <Head title="Recommendations" />

            <PageHeader
                title="Recommendations"
                description="Read-only optimization recommendations from the perf package's engine — index suggestions, slow pages, cache misses. Apply the DDL manually via your migration workflow."
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

                {error && <div className="alert alert-error mb-4">Failed to load recommendations: {error}</div>}

                {loading && <div className="text-center text-base-content/60">Loading…</div>}

                {!loading && !error && items.length === 0 && (
                    <div className="rounded-lg bg-base-200 p-6 text-center text-base-content/60">
                        No recommendations available. The engine reads from the slow query
                        log and metrics tables — enable slow query logging under Settings →
                        Performance and let a bit of traffic accumulate first.
                    </div>
                )}

                {!loading && items.length > 0 && (
                    <div className="flex flex-col gap-4">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="rounded-lg border border-base-300 p-4"
                            >
                                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                                    <h3 className="text-lg font-semibold">{item.title}</h3>
                                    <span className="text-xs uppercase text-base-content/50">{item.type}</span>
                                </div>
                                {item.detail && (
                                    <p className="text-sm text-base-content/75">{item.detail}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </PerformanceAdminLayout>
    );
}
