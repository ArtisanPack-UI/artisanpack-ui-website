import { type ReactNode } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, EmptyState, PageHeader } from '@/components/admin/keystone';
import {
    create as contentCreate,
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

interface PageProps extends KeystoneSharedProps {
    contentType: ContentTypeSummary;
    records: Record<string, unknown>[];
    fields: FieldDef[];
    flash?: { success?: string; warning?: string; error?: string };
    errors?: Record<string, string>;
    [key: string]: unknown;
}

export default function DynamicContentIndex() {
    const { contentType, records, fields, flash, errors } = usePage<PageProps>().props;

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
                            <Link
                                href={contentCreate(contentType.slug).url}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90"
                            >
                                New {contentType.name.toLowerCase()}
                            </Link>
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
                    </Card>
                )}
            </div>
        </>
    );
}

function formatCell(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

DynamicContentIndex.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
