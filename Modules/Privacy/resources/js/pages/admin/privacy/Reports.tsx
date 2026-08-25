/* eslint-disable react-hooks/set-state-in-effect -- Classic
   fetch-on-mount pattern; cascading render from loading→loaded is
   intentional. */

import { useEffect, useState, type ReactElement } from 'react';
import { Head } from '@inertiajs/react';
import PrivacyAdminLayout from '../../../layouts/PrivacyAdminLayout';
import { Card, PageHeader } from '@/components/admin/keystone';
import { privacyApi } from '@/lib/vendor/privacy-endpoints';

interface PeriodOption {
    value: string;
    label: string;
}

interface ReportsPageProps {
    periods: PeriodOption[];
}

interface ComplianceReport {
    period: string;
    generated_at: string;
    consents: Record<string, unknown>;
    requests: Record<string, unknown>;
    breaches: Record<string, unknown>;
    [key: string]: unknown;
}

const DEFAULT_PERIOD = 'month';

function defaultPeriod(periods: PeriodOption[]): string {
    return periods.find((p) => p.value === DEFAULT_PERIOD)?.value ?? periods[0]?.value ?? DEFAULT_PERIOD;
}

export default function Reports({ periods }: ReportsPageProps): ReactElement {
    const [period, setPeriod] = useState(() => defaultPeriod(periods));
    const [report, setReport] = useState<ComplianceReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Race guard: abort the in-flight report request whenever the
        // period changes so a slow "last-90-days" query can't stomp on
        // the fresher "last-7-days" response the user just triggered.
        const controller = new AbortController();
        setLoading(true);
        setError(null);

        fetch(`${privacyApi.admin.complianceReport()}?period=${encodeURIComponent(period)}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then((body) => setReport(body as ComplianceReport))
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
    }, [period]);

    return (
        <PrivacyAdminLayout>
            <Head title="Compliance Reports" />

            <PageHeader
                title="Compliance Reports"
                description="On-demand render of the package's compliance-report data, mirroring the scheduled monthly export."
            />

            <Card>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-base-content/60">Period:</span>
                    {periods.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setPeriod(option.value)}
                            aria-pressed={period === option.value}
                            className={`btn btn-sm ${period === option.value ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {error && <div className="alert alert-error mb-4">{error}</div>}

                {loading && <div className="text-center text-base-content/60">Loading…</div>}

                {!loading && report && (
                    <div className="grid gap-6">
                        <ReportSection title="Consents" data={report.consents} />
                        <ReportSection title="Data Subject Requests" data={report.requests} />
                        <ReportSection title="Breaches" data={report.breaches} />
                    </div>
                )}
            </Card>
        </PrivacyAdminLayout>
    );
}

function ReportSection({ title, data }: { title: string; data: Record<string, unknown> }): ReactElement {
    return (
        <section>
            <h3 className="mb-2 text-lg font-semibold">{title}</h3>
            <pre className="max-h-96 overflow-auto rounded-lg bg-base-200 p-4 text-xs">
                {JSON.stringify(data, null, 2)}
            </pre>
        </section>
    );
}
