import { type ReactNode } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, EmptyState, PageHeader } from '@/components/admin/keystone';
import {
    AddContentModal,
    type AddContentModalOption,
} from '@/components/admin/AddContentModal';
import { useAddContentModal } from '@/lib/admin/useAddContentModal';
import {
    destroy as contentDestroy,
    edit as contentEdit,
} from '@/routes/admin/content';
import { FlashCards } from './ContentTypes';
import type { KeystoneSharedProps } from '@/types/keystone';

interface ContentTypeSummary {
    slug: string;
    name: string;
    description: string;
    table_name: string;
    has_table: boolean;
    supports: string[];
}

interface FieldDef { name: string; key: string; type: string; required: boolean }

interface NewContentPayload {
    label: string;
    hierarchical: boolean;
    parentOptions: AddContentModalOption[];
    templates: AddContentModalOption[];
    quickCreateUrl: string;
}

interface Pagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    prev_url: string | null;
    next_url: string | null;
}

interface PageProps extends KeystoneSharedProps {
    contentType: ContentTypeSummary;
    records: Record<string, unknown>[];
    pagination: Pagination;
    fields: FieldDef[];
    newContent: NewContentPayload;
    flash?: { success?: string; warning?: string; error?: string };
    errors?: Record<string, string>;
    [key: string]: unknown;
}

export default function DynamicContentIndex() {
    const { contentType, records, pagination, fields, newContent, flash, errors } =
        usePage<PageProps>().props;
    // #184 — landing from an "Add …" menu link auto-opens the modal
    // (via `?new=1`); the hook also strips the parameter on close so a
    // reload or a Back doesn't reopen a dismissed dialog.
    //
    // Gated on `has_table`: without a backing table the "New …" trigger is
    // replaced by a disabled notice, so honouring `?new=1` would open a
    // create form that cannot write — and leave the modal with no trigger
    // to hand focus back to on close (#193 review).
    const {
        open: modalOpen,
        openModal,
        closeModal,
    } = useAddContentModal(contentType.has_table);

    function handleDelete(id: number) {
        if (!confirm('Remove this record?')) return;
        router.delete(contentDestroy([contentType.slug, id]).url, { preserveScroll: true });
    }

    const columnKeys = ['id', 'title', ...fields.slice(0, 4).map((f) => f.key)];

    return (
        <>
            <Head title={contentType.name} />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title={contentType.name}
                    description={contentType.description || `Manage ${contentType.name.toLowerCase()} records.`}
                    breadcrumbs={['Content', contentType.name]}
                    actions={
                        contentType.has_table ? (
                            <button
                                id="new-content-trigger"
                                type="button"
                                onClick={openModal}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:outline-none"
                            >
                                New {contentType.name.toLowerCase()}
                            </button>
                        ) : (
                            <span
                                title="No backing table yet — see warning below."
                                className="inline-flex items-center gap-1.5 rounded-lg border border-base-300 px-3 py-2 text-xs font-semibold text-base-content/50"
                            >
                                New {contentType.name.toLowerCase()}
                            </span>
                        )
                    }
                />

                <AddContentModal
                    open={modalOpen}
                    onClose={closeModal}
                    label={newContent.label}
                    hierarchical={newContent.hierarchical}
                    parentOptions={newContent.parentOptions}
                    templates={newContent.templates}
                    quickCreateUrl={newContent.quickCreateUrl}
                />

                <FlashCards flash={flash} errors={errors} />

                {!contentType.has_table ? (
                    <Card className="border-warning/30 bg-warning/5 text-sm text-warning">
                        Records table <code className="font-mono">{contentType.table_name}</code> does not exist yet. Run the pending migration to create it before adding records.
                    </Card>
                ) : null}

                {records.length === 0 ? (
                    <Card>
                        <EmptyState title={`No ${contentType.name.toLowerCase()} yet`} description="Create the first record to see it here." />
                    </Card>
                ) : (
                    <Card>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-base-300 text-xs font-semibold uppercase text-base-content/60">
                                        {columnKeys.map((k) => (
                                            <th key={k} className="px-3 py-2">{k}</th>
                                        ))}
                                        <th className="px-3 py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map((row, i) => (
                                        <tr key={String(row.id ?? i)} className="border-b border-base-300/50 last:border-0">
                                            {columnKeys.map((k) => (
                                                <td key={k} className="px-3 py-2 text-base-content/80">{formatCell(row[k])}</td>
                                            ))}
                                            <td className="px-3 py-2 text-right">
                                                <Link
                                                    href={contentEdit([contentType.slug, row.id as number]).url}
                                                    className="inline-flex cursor-pointer items-center gap-1 rounded border border-base-300 px-2 py-1 text-xs hover:bg-base-200"
                                                >
                                                    Edit
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(Number(row.id))}
                                                    className="ml-2 inline-flex cursor-pointer items-center gap-1 rounded border border-base-300 px-2 py-1 text-xs hover:bg-base-200"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {pagination.last_page > 1 && (
                            <nav
                                aria-label="Pagination"
                                className="flex items-center justify-between gap-3 border-t border-base-300/60 px-3 py-2 text-xs"
                            >
                                <span className="text-base-content/70">
                                    Page {pagination.current_page} of {pagination.last_page} ·{' '}
                                    {pagination.total} records
                                </span>
                                <span className="flex items-center gap-2">
                                    <PageLink href={pagination.prev_url} label="Previous" />
                                    <PageLink href={pagination.next_url} label="Next" />
                                </span>
                            </nav>
                        )}
                    </Card>
                )}
            </div>
        </>
    );
}

/**
 * One end of the pager. Rendered as an `aria-disabled` span rather than
 * omitted at the ends of the range, so the control keeps its position and
 * a screen-reader user is told the direction exists but isn't available —
 * the same reasoning as the panel menu's unavailable move commands.
 */
function PageLink({ href, label }: { href: string | null; label: string }) {
    if (href === null) {
        return (
            <span
                aria-disabled="true"
                className="inline-flex items-center rounded border border-base-300/60 px-2 py-1 font-semibold text-base-content/35"
            >
                {label}
            </span>
        );
    }

    return (
        <Link
            href={href}
            preserveScroll
            className="inline-flex items-center rounded border border-base-300 px-2 py-1 font-semibold hover:bg-base-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
            {label}
        </Link>
    );
}

function formatCell(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

DynamicContentIndex.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
