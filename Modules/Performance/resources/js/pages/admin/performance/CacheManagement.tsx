/* eslint-disable react-hooks/set-state-in-effect -- Classic
   fetch-on-mount / filter-change pattern; the cascading render from
   loading→loaded is intentional. */

import { useEffect, useState, type ReactElement } from 'react';
import { Head } from '@inertiajs/react';
import PerformanceAdminLayout from '../../../layouts/PerformanceAdminLayout';
import { Card, KpiTile, PageHeader, StatusBadge } from '@/components/admin/keystone';
import { performanceApi } from '@/lib/vendor/performance-endpoints';

interface CacheManagementPageProps {
    features: {
        page_cache: boolean;
        fragment_cache: boolean;
        cache_warming: boolean;
    };
}

/**
 * Shape of the vendor's `/admin/cache` response. Kept as-is from the
 * package so a version bump surfaces here as a type error rather than
 * a silent render change.
 */
interface CachePayload {
    summary: {
        page: { entries: number; size_bytes: number; hits: number; misses: number };
        fragment: { entries: number; tags: number; hits: number; misses: number };
    };
    page_entries: Array<{
        key: string;
        route: string | null;
        size_bytes: number;
        hits: number;
        misses: number;
        expires_at: string | null;
    }>;
    fragment_tags: Array<{
        tag: string;
        entries: number;
    }>;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readCsrfToken(): string {
    const tag = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    return tag?.content ?? '';
}

export default function CacheManagement({ features }: CacheManagementPageProps): ReactElement {
    const [payload, setPayload] = useState<CachePayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [messageFailed, setMessageFailed] = useState(false);
    const [refreshTick, setRefreshTick] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);

        fetch(performanceApi.admin.cache(), {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then((body) => setPayload(body as CachePayload))
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
    }, [refreshTick]);

    async function invoke(action: 'flush' | 'warm' | 'invalidate-key' | 'invalidate-tag', extra: Record<string, string> = {}): Promise<void> {
        setBusy(true);
        setMessage(null);
        setMessageFailed(false);
        try {
            const res = await fetch(performanceApi.admin.cacheActions(), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': readCsrfToken(),
                },
                body: JSON.stringify({ action, ...extra }),
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const body = (await res.json()) as { message?: string };
            setMessage(body.message ?? `Action completed: ${action}`);
        } catch (err) {
            setMessage(`Action failed: ${(err as Error).message}`);
            setMessageFailed(true);
        } finally {
            setBusy(false);
            // Refetch the snapshot whether the action succeeded or
            // failed — even a failed invalidation might have partially
            // dropped entries the vendor logs but doesn't rethrow.
            setRefreshTick((prev) => prev + 1);
        }
    }

    const summary = payload?.summary;
    const pageEntries = payload?.page_entries ?? [];
    const fragmentTags = payload?.fragment_tags ?? [];

    return (
        <PerformanceAdminLayout>
            <Head title="Cache Management" />

            <PageHeader
                title="Cache Management"
                description="Inspect the perf package's page and fragment caches, purge by key or tag, and trigger a warm run."
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <KpiTile
                    label="Page cache entries"
                    value={(summary?.page.entries ?? 0).toLocaleString()}
                />
                <KpiTile
                    label="Fragment cache entries"
                    value={(summary?.fragment.entries ?? 0).toLocaleString()}
                />
                <div className="rounded-lg bg-base-100 p-4 shadow">
                    <p className="mb-2 text-sm text-base-content/60">Feature status</p>
                    <div className="flex flex-wrap gap-2">
                        <StatusBadge
                            status={features.page_cache ? 'active' : 'inactive'}
                            label={`Page cache: ${features.page_cache ? 'on' : 'off'}`}
                            tone={features.page_cache ? 'success' : 'neutral'}
                        />
                        <StatusBadge
                            status={features.fragment_cache ? 'active' : 'inactive'}
                            label={`Fragment cache: ${features.fragment_cache ? 'on' : 'off'}`}
                            tone={features.fragment_cache ? 'success' : 'neutral'}
                        />
                        <StatusBadge
                            status={features.cache_warming ? 'active' : 'inactive'}
                            label={`Warming: ${features.cache_warming ? 'on' : 'off'}`}
                            tone={features.cache_warming ? 'success' : 'neutral'}
                        />
                    </div>
                </div>
            </div>

            <Card>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => invoke('flush')}
                        disabled={busy}
                        className="btn btn-sm btn-error"
                    >
                        Flush all
                    </button>
                    <button
                        type="button"
                        onClick={() => invoke('warm')}
                        disabled={busy || !features.cache_warming}
                        className="btn btn-sm btn-primary"
                        title={!features.cache_warming ? 'Enable cache warming under Settings → Performance.' : ''}
                    >
                        Warm cache
                    </button>
                </div>

                {message && (
                    <div
                        className={`alert mb-4 ${messageFailed ? 'alert-error' : 'alert-info'}`}
                        role={messageFailed ? 'alert' : 'status'}
                    >
                        {message}
                    </div>
                )}
                {error && <div className="alert alert-error mb-4">Failed to load cache snapshot: {error}</div>}

                {loading && <div className="text-center text-base-content/60">Loading…</div>}

                {!loading && !error && pageEntries.length === 0 && fragmentTags.length === 0 && (
                    <div className="rounded-lg bg-base-200 p-6 text-center text-base-content/60">
                        No cache entries.
                    </div>
                )}

                {!loading && pageEntries.length > 0 && (
                    <div className="mb-6">
                        <h3 className="mb-2 text-base font-semibold">Page cache entries</h3>
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Key</th>
                                        <th>Route</th>
                                        <th>Size</th>
                                        <th>Hits</th>
                                        <th>Misses</th>
                                        <th>Expires</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageEntries.map((row) => (
                                        <tr key={row.key}>
                                            <td>
                                                <code className="text-xs">{row.key}</code>
                                            </td>
                                            <td>{row.route ? <code className="text-xs">{row.route}</code> : '—'}</td>
                                            <td>{formatBytes(row.size_bytes)}</td>
                                            <td>{row.hits.toLocaleString()}</td>
                                            <td>{row.misses.toLocaleString()}</td>
                                            <td className="whitespace-nowrap">{row.expires_at ?? 'never'}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    onClick={() => invoke('invalidate-key', { key: row.key })}
                                                    disabled={busy}
                                                    className="btn btn-xs btn-ghost"
                                                >
                                                    Purge
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {!loading && fragmentTags.length > 0 && (
                    <div>
                        <h3 className="mb-2 text-base font-semibold">Fragment cache tags</h3>
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Tag</th>
                                        <th>Entries</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {fragmentTags.map((row) => (
                                        <tr key={row.tag}>
                                            <td>
                                                <code className="text-xs">{row.tag}</code>
                                            </td>
                                            <td>{row.entries.toLocaleString()}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    onClick={() => invoke('invalidate-tag', { tag: row.tag })}
                                                    disabled={busy}
                                                    className="btn btn-xs btn-ghost"
                                                >
                                                    Purge
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Card>
        </PerformanceAdminLayout>
    );
}
