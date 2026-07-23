/* eslint-disable react-hooks/set-state-in-effect -- Classic
   fetch-on-mount pattern; cascading render from loading→loaded is
   intentional. */

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Head } from '@inertiajs/react';
import PrivacyAdminLayout from '@/layouts/PrivacyAdminLayout';
import { Card, PageHeader, StatusBadge } from '@/components/admin/keystone';
import { privacyApi } from '@/lib/vendor/privacy-endpoints';

interface BreachRow {
    id: number;
    reference: string;
    severity: string;
    description: string;
    detected_at: string | null;
    authority_notified_at: string | null;
    users_notified_at: string | null;
    affected_users: number | null;
}

interface BreachesPageProps {
    summary: {
        total: number;
        authority_notified: number;
    };
}

const SEVERITY_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
    low: 'info',
    medium: 'warning',
    high: 'error',
    critical: 'error',
};

export default function Breaches({ summary }: BreachesPageProps): ReactElement {
    const [rows, setRows] = useState<BreachRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        fetch(privacyApi.admin.breaches(), {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then((body) => setRows(Array.isArray(body?.data) ? (body.data as BreachRow[]) : []))
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <PrivacyAdminLayout>
            <Head title="Breach Manager" />

            <PageHeader
                title="Breach Manager"
                description="Track breach records and drive the authority + user notification workflow."
            />

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <div className="text-sm text-base-content/60">Recorded breaches</div>
                    <div className="mt-1 text-3xl font-semibold">{summary.total.toLocaleString()}</div>
                </Card>
                <Card>
                    <div className="text-sm text-base-content/60">Authority notified</div>
                    <div className="mt-1 text-3xl font-semibold">
                        {summary.authority_notified.toLocaleString()}
                    </div>
                </Card>
            </div>

            <Card>
                {error && <div className="alert alert-error mb-4">{error}</div>}
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Reference</th>
                                <th>Severity</th>
                                <th>Detected</th>
                                <th>Authority</th>
                                <th>Users</th>
                                <th>Affected</th>
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
                                        No breaches recorded. Use the package&rsquo;s <code>BreachNotificationService</code> or the JSON API to add one.
                                    </td>
                                </tr>
                            )}
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    <td>
                                        <div className="font-medium">{row.reference}</div>
                                        <div className="text-xs text-base-content/60">{row.description}</div>
                                    </td>
                                    <td className="capitalize">
                                        <StatusBadge
                                            status="active"
                                            label={row.severity}
                                            tone={SEVERITY_TONE[row.severity] ?? 'neutral'}
                                        />
                                    </td>
                                    <td>
                                        <span className="text-sm text-base-content/70">{row.detected_at ?? '—'}</span>
                                    </td>
                                    <td>
                                        <span className="text-sm text-base-content/70">
                                            {row.authority_notified_at ?? 'Not sent'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="text-sm text-base-content/70">
                                            {row.users_notified_at ?? 'Not sent'}
                                        </span>
                                    </td>
                                    <td>{row.affected_users?.toLocaleString() ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </PrivacyAdminLayout>
    );
}
