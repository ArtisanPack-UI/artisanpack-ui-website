import { useState, type ReactNode } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import {
    Card,
    Icon,
    PageHeader,
    StatusBadge,
    Widget,
    type Tone,
} from '@/components/admin/keystone';
import { CreateFormModal } from '@/components/admin/forms/CreateFormModal';
import { formatNumber, formatRelativeTime } from '@/lib/admin/shared';
import type { FormRow, LeadRow } from '@/types/keystone';
import forms from '@/routes/admin/forms';

const leadTone: Record<LeadRow['status'], Tone> = {
    new: 'accent',
    contacted: 'info',
    qualified: 'success',
};

const statusTone: Record<FormRow['status'], Tone> = {
    active: 'success',
    paused: 'warning',
    draft: 'neutral',
};

interface FormsProps {
    forms: FormRow[];
    recent_leads: LeadRow[];
    limit: { max: number | null; current: number };
    flash?: { success?: string; error?: string };
    [key: string]: unknown;
}

export default function Forms() {
    const {
        forms: rows,
        recent_leads,
        limit,
        flash,
    } = usePage<FormsProps>().props;

    const atLimit = limit.max !== null && limit.current >= limit.max;
    const [createOpen, setCreateOpen] = useState(false);

    function handleDelete(form: FormRow) {
        if (!confirm(`Delete "${form.name}"? This cannot be undone.`)) return;
        router.delete(forms.destroy(form.id).url, { preserveScroll: true });
    }

    return (
        <>
            <Head title="Forms" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Forms"
                    breadcrumbs={['Lead Generation', 'Forms']}
                    description="Build and analyze lead capture forms across your site."
                    actions={
                        atLimit ? (
                            <span
                                className="inline-flex items-center gap-1.5 rounded-lg bg-base-200 px-3 py-2 text-xs font-semibold text-base-content/60"
                                title={`Form limit (${limit.max}) reached`}
                            >
                                Limit reached ({limit.current}/{limit.max})
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setCreateOpen(true)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90"
                            >
                                {Icon.plus}
                                New form
                            </button>
                        )
                    }
                />

                {flash?.success && (
                    <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
                        {flash.error}
                    </div>
                )}

                <div className="grid grid-cols-12 gap-7">
                    <div className="col-span-12 lg:col-span-7 xl:col-span-8">
                        <Card padded={false}>
                            <div className="border-b border-base-300/60 px-5 py-3 text-sm font-semibold text-base-content">
                                All forms ({rows.length})
                            </div>
                            {rows.length === 0 ? (
                                <div className="px-5 py-12 text-center text-sm text-base-content/55">
                                    No forms yet. Click <span className="font-semibold">New form</span> to create your first.
                                </div>
                            ) : (
                                <ul>
                                    {rows.map((f) => (
                                        <li
                                            key={f.id}
                                            className="flex items-center gap-4 border-b border-base-300/40 px-5 py-4 last:border-b-0 hover:bg-base-200/40"
                                        >
                                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/8 text-primary">
                                                {Icon.forms}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={forms.edit(f.id).url}
                                                        className="font-semibold text-base-content hover:text-primary"
                                                    >
                                                        {f.name}
                                                    </Link>
                                                    <StatusBadge label={f.status} tone={statusTone[f.status]} />
                                                </div>
                                                <div className="text-xs text-base-content/55">
                                                    {f.last_submission
                                                        ? `Last submission ${formatRelativeTime(f.last_submission)}`
                                                        : 'No submissions yet'}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6 text-right">
                                                <div>
                                                    <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-base-content/45">
                                                        Submissions
                                                    </div>
                                                    <div className="font-mono text-sm font-semibold text-base-content">
                                                        {formatNumber(f.submissions)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-base-content/45">
                                                        Unread
                                                    </div>
                                                    <div className="font-mono text-sm font-semibold text-base-content">
                                                        {formatNumber(f.unread ?? 0)}
                                                    </div>
                                                </div>
                                            </div>
                                            <Link
                                                href={forms.submissions.index(f.id).url}
                                                className="rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                                            >
                                                Submissions
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(f)}
                                                aria-label={`Delete ${f.name}`}
                                                className="grid h-7 w-7 place-items-center rounded-md text-base-content/55 hover:bg-error/10 hover:text-error"
                                            >
                                                {Icon.trash ?? Icon.kebab}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    </div>

                    <div className="col-span-12 lg:col-span-5 xl:col-span-4">
                        <Widget
                            title="Recent submissions"
                            subtitle="Across all forms"
                            footer={
                                <Link
                                    href={forms.submissions.all().url}
                                    className="font-semibold text-primary hover:underline"
                                >
                                    Open lead inbox →
                                </Link>
                            }
                        >
                            {recent_leads.length === 0 ? (
                                <p className="text-sm text-base-content/55">
                                    Submissions will appear here once your forms start receiving them.
                                </p>
                            ) : (
                                <ul className="flex flex-col gap-3">
                                    {recent_leads.map((lead) => (
                                        <li
                                            key={lead.id}
                                            className="rounded-lg border border-base-300/40 bg-base-200/40 px-3 py-2.5"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-base-content">{lead.name}</span>
                                                <StatusBadge label={lead.status} tone={leadTone[lead.status] ?? 'neutral'} />
                                            </div>
                                            <div className="text-xs text-base-content/65">
                                                {lead.email || '—'} · {lead.form}
                                            </div>
                                            <div className="mt-1 text-[11px] text-base-content/45">
                                                {formatRelativeTime(lead.received_at)}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Widget>
                    </div>
                </div>
            </div>

            <CreateFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
        </>
    );
}

Forms.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
