/* eslint-disable react-hooks/set-state-in-effect -- Classic
   fetch-on-mount pattern; cascading render from loading→loaded is
   intentional. */

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Head } from '@inertiajs/react';
import PrivacyAdminLayout from '@/layouts/PrivacyAdminLayout';
import { Card, PageHeader, StatusBadge } from '@/components/admin/keystone';
import { privacyApi } from '@/lib/vendor/privacy-endpoints';

interface DsrRow {
    id: number;
    type: string;
    email: string | null;
    user_id: number | null;
    status: string;
    submitted_at: string | null;
    verified_at: string | null;
    deadline_at: string | null;
}

interface DsrSummary {
    pending: number;
    verified: number;
    processing: number;
    completed: number;
    rejected: number;
}

interface DataRequestsPageProps {
    summary: DsrSummary;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
    pending: 'warning',
    verified: 'info',
    processing: 'info',
    completed: 'success',
    rejected: 'error',
};

function getCsrf(): string {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '';
}

export default function DataRequests({ summary }: DataRequestsPageProps): ReactElement {
    const [rows, setRows] = useState<DsrRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('pending');
    // Held in a ref so the imperative post-action reload (`load()`) and
    // the effect-driven filter-change reload share the same abort token
    // — a stale slow query never lands after the user has already
    // moved on.
    const abortRef = useRef<AbortController | null>(null);

    const load = useCallback(() => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        setError(null);

        fetch(`${privacyApi.admin.dataRequests()}?status=${encodeURIComponent(status)}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then((body) => setRows(Array.isArray(body?.data) ? (body.data as DsrRow[]) : []))
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
    }, [status]);

    useEffect(() => {
        load();
        return () => abortRef.current?.abort();
    }, [load]);

    async function performAction(request: DsrRow, action: 'approve' | 'reject' | 'complete') {
        const reason =
            action === 'reject'
                ? window.prompt('Reason for rejection?', 'Unable to verify identity.') ?? undefined
                : undefined;
        if (action === 'reject' && !reason) {
            return;
        }

        setError(null);
        try {
            const res = await fetch(privacyApi.admin.dataRequestAction(request.id), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrf(),
                    Accept: 'application/json',
                },
                body: JSON.stringify({ action, reason }),
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            load();
        } catch (err) {
            setError((err as Error).message);
        }
    }

    return (
        <PrivacyAdminLayout>
            <Head title="Data Subject Requests" />

            <PageHeader
                title="Data Subject Requests"
                description="Manually approve, reject, or complete every access, export, deletion, and rectification request."
            />

            <div className="grid gap-4 md:grid-cols-5">
                {(Object.entries(summary) as Array<[keyof DsrSummary, number]>).map(([key, value]) => (
                    <Card key={key}>
                        <div className="text-sm capitalize text-base-content/60">{key}</div>
                        <div className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</div>
                    </Card>
                ))}
            </div>

            <Card>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    {['pending', 'verified', 'processing', 'completed', 'rejected', 'all'].map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setStatus(option)}
                            aria-pressed={status === option}
                            className={`btn btn-sm capitalize ${status === option ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            {option}
                        </button>
                    ))}
                </div>

                {error && <div className="alert alert-error mb-4">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Subject</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Submitted</th>
                                <th>Deadline</th>
                                <th className="text-right">Actions</th>
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
                                        No requests match the current filter.
                                    </td>
                                </tr>
                            )}
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    <td>
                                        <div className="font-medium">{row.email ?? `User #${row.user_id ?? '—'}`}</div>
                                    </td>
                                    <td className="capitalize">{row.type}</td>
                                    <td>
                                        <StatusBadge
                                            status={row.status === 'completed' ? 'active' : 'inactive'}
                                            label={row.status}
                                            tone={STATUS_TONE[row.status] ?? 'neutral'}
                                        />
                                    </td>
                                    <td>
                                        <span className="text-sm text-base-content/70">{row.submitted_at ?? '—'}</span>
                                    </td>
                                    <td>
                                        <span className="text-sm text-base-content/70">{row.deadline_at ?? '—'}</span>
                                    </td>
                                    <td className="text-right">
                                        {(row.status === 'pending' || row.status === 'verified') && (
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-xs btn-primary"
                                                    onClick={() => performAction(row, 'approve')}
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-xs btn-ghost text-error"
                                                    onClick={() => performAction(row, 'reject')}
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                        {row.status === 'processing' && (
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-primary"
                                                onClick={() => performAction(row, 'complete')}
                                            >
                                                Mark complete
                                            </button>
                                        )}
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
