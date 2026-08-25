/* eslint-disable react-hooks/set-state-in-effect -- Classic
   "fetch on mount / on filter change → set data + loading state" pattern.
   The rule flags synchronous setState inside effects; here that's exactly
   what we want (transition from loading placeholder to loaded/errored). */

import { useEffect, useState, type ReactElement } from 'react';
import { Head } from '@inertiajs/react';
import PrivacyAdminLayout from '../../../layouts/PrivacyAdminLayout';
import { Card, PageHeader, StatusBadge } from '@/components/admin/keystone';
import { privacyApi } from '@/lib/vendor/privacy-endpoints';

interface ConsentRow {
    id: number;
    user_id: number | null;
    guest_identifier: string | null;
    category: string;
    granted: boolean;
    granted_at: string | null;
    expires_at: string | null;
    region: string | null;
    regulation: string | null;
}

interface ConsentsPageProps {
    summary: {
        total: number;
        granted: number;
        withdrawn: number;
    };
}

export default function Consents({ summary }: ConsentsPageProps): ReactElement {
    const [rows, setRows] = useState<ConsentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'granted' | 'withdrawn'>('all');

    useEffect(() => {
        // Abort the in-flight request whenever the filter flips so a
        // slower "all" query can't overwrite the fresher "granted"
        // response the user just switched to.
        const controller = new AbortController();
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (filter !== 'all') {
            params.set('status', filter);
        }

        fetch(`${privacyApi.admin.consents()}?${params.toString()}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then((body) => {
                const data = Array.isArray(body?.data) ? body.data : [];
                setRows(data as ConsentRow[]);
            })
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
    }, [filter]);

    return (
        <PrivacyAdminLayout>
            <Head title="Consent Manager" />

            <PageHeader
                title="Consent Manager"
                description="Search and audit recorded consents. Backed by the artisanpack-ui/privacy JSON API."
            />

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <div className="text-sm text-base-content/60">Total consents</div>
                    <div className="mt-1 text-3xl font-semibold">{summary.total.toLocaleString()}</div>
                </Card>
                <Card>
                    <div className="text-sm text-base-content/60">Granted</div>
                    <div className="mt-1 text-3xl font-semibold">{summary.granted.toLocaleString()}</div>
                </Card>
                <Card>
                    <div className="text-sm text-base-content/60">Withdrawn</div>
                    <div className="mt-1 text-3xl font-semibold">{summary.withdrawn.toLocaleString()}</div>
                </Card>
            </div>

            <Card>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    {(['all', 'granted', 'withdrawn'] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setFilter(option)}
                            aria-pressed={filter === option}
                            className={`btn btn-sm ${filter === option ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            {option === 'all' ? 'All' : option.charAt(0).toUpperCase() + option.slice(1)}
                        </button>
                    ))}
                </div>

                {error && <div className="alert alert-error mb-4">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Subject</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Region</th>
                                <th>Granted</th>
                                <th>Expires</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={6} className="text-center text-base-content/60">
                                        Loading…
                                    </td>
                                </tr>
                            )}
                            {!loading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center text-base-content/60">
                                        No consents match the current filter.
                                    </td>
                                </tr>
                            )}
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    <td>
                                        {row.user_id ? (
                                            <span className="font-medium">User #{row.user_id}</span>
                                        ) : (
                                            <span className="text-base-content/60">Guest · {row.guest_identifier?.slice(0, 12)}…</span>
                                        )}
                                    </td>
                                    <td>
                                        <code className="text-xs">{row.category}</code>
                                    </td>
                                    <td>
                                        <StatusBadge
                                            status={row.granted ? 'active' : 'inactive'}
                                            label={row.granted ? 'Granted' : 'Withdrawn'}
                                            tone={row.granted ? 'success' : 'neutral'}
                                        />
                                    </td>
                                    <td>
                                        <span className="text-sm text-base-content/70">
                                            {row.region ?? '—'}
                                            {row.regulation ? ` (${row.regulation})` : ''}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="text-sm text-base-content/70">
                                            {row.granted_at ?? '—'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="text-sm text-base-content/70">
                                            {row.expires_at ?? '—'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </PrivacyAdminLayout>
    );
}
