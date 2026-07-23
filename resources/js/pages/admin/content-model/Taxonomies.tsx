import { useState, type FormEvent, type ReactNode } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, EmptyState, PageHeader } from '@/components/admin/keystone';
import {
    destroy as taxonomyDestroy,
    edit as taxonomyEdit,
    store as taxonomyStore,
} from '@/routes/admin/content-model/taxonomies';
import { FlashCards, TextField, BoolField } from './ContentTypes';
import type { KeystoneSharedProps } from '@/types/keystone';

interface TaxonomyRow {
    id: number | null;
    slug: string;
    name: string;
    content_type_slug: string;
    description: string;
    hierarchical: boolean;
    show_in_admin: boolean;
    rest_base: string;
    is_editable: boolean;
}

interface ContentTypeOption {
    slug: string;
    name: string;
}

interface PageProps extends KeystoneSharedProps {
    taxonomies: TaxonomyRow[];
    contentTypes: ContentTypeOption[];
    flash?: { success?: string; warning?: string; error?: string };
    errors?: Record<string, string>;
    [key: string]: unknown;
}

export default function Taxonomies() {
    const { taxonomies, contentTypes, flash, errors } = usePage<PageProps>().props;
    const [showCreate, setShowCreate] = useState(false);

    const form = useForm({
        name: '',
        slug: '',
        content_type_slug: contentTypes[0]?.slug ?? '',
        description: '',
        hierarchical: false,
        show_in_admin: true,
        rest_base: '',
    });

    function handleCreate(event: FormEvent) {
        event.preventDefault();
        form.post(taxonomyStore().url, {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setShowCreate(false);
            },
        });
    }

    function handleDelete(row: TaxonomyRow) {
        if (!row.is_editable) return;
        if (!confirm(`Remove taxonomy "${row.name}"?`)) return;
        router.delete(taxonomyDestroy(row.slug).url, { preserveScroll: true });
    }

    return (
        <>
            <Head title="Taxonomies" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Taxonomies"
                    description="Group content records by category, tag, or any custom classification."
                    breadcrumbs={['Content Model', 'Taxonomies']}
                    actions={
                        <button
                            type="button"
                            onClick={() => setShowCreate((v) => !v)}
                            disabled={contentTypes.length === 0}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90 disabled:opacity-50"
                            title={contentTypes.length === 0 ? 'Create a content type first' : undefined}
                        >
                            {showCreate ? 'Cancel' : 'New taxonomy'}
                        </button>
                    }
                />

                <FlashCards flash={flash} errors={errors} />

                {showCreate ? (
                    <Card>
                        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <TextField label="Name" value={form.data.name} onChange={(v) => form.setData('name', v)} error={form.errors.name} required />
                            <TextField label="Slug" value={form.data.slug} onChange={(v) => form.setData('slug', v)} error={form.errors.slug} placeholder="region" required />
                            <div>
                                <label className="text-xs font-semibold text-base-content/60">Content type *</label>
                                <select
                                    value={form.data.content_type_slug}
                                    onChange={(e) => form.setData('content_type_slug', e.target.value)}
                                    className="mt-1 block w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm"
                                >
                                    {contentTypes.map((ct) => (
                                        <option key={ct.slug} value={ct.slug}>{ct.name}</option>
                                    ))}
                                </select>
                                {form.errors.content_type_slug ? <div className="mt-1 text-xs text-error">{form.errors.content_type_slug}</div> : null}
                            </div>
                            <TextField label="REST base" value={form.data.rest_base} onChange={(v) => form.setData('rest_base', v)} error={form.errors.rest_base} />
                            <TextField label="Description" value={form.data.description} onChange={(v) => form.setData('description', v)} error={form.errors.description} className="md:col-span-2" />
                            <BoolField label="Hierarchical" value={form.data.hierarchical} onChange={(v) => form.setData('hierarchical', v)} />
                            <BoolField label="Show in admin" value={form.data.show_in_admin} onChange={(v) => form.setData('show_in_admin', v)} />
                            <div className="md:col-span-2 flex items-center gap-2">
                                <button type="submit" disabled={form.processing} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90 disabled:opacity-50">
                                    {form.processing ? 'Creating…' : 'Create taxonomy'}
                                </button>
                            </div>
                        </form>
                    </Card>
                ) : null}

                {taxonomies.length === 0 ? (
                    <Card>
                        <EmptyState title="No taxonomies" description="Create a taxonomy to classify content." />
                    </Card>
                ) : (
                    <div className="grid grid-cols-12 gap-7">
                        {taxonomies.map((row) => (
                            <Card key={row.slug} className="col-span-12 md:col-span-6 xl:col-span-4 flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-display text-base font-semibold text-base-content">{row.name}</div>
                                        <div className="text-xs text-base-content/55 font-mono">{row.slug} → {row.content_type_slug}</div>
                                    </div>
                                    {row.is_editable ? null : (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-base-300 bg-base-200/60 px-2 py-0.5 text-[11px] font-semibold text-base-content/60">
                                            Registered
                                        </span>
                                    )}
                                </div>
                                {row.description ? <div className="text-sm text-base-content/65">{row.description}</div> : null}
                                <div className="mt-auto flex flex-wrap items-center gap-2">
                                    {row.is_editable ? (
                                        <>
                                            <Link
                                                href={taxonomyEdit(row.slug).url}
                                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-base-300 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200"
                                            >
                                                Edit
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(row)}
                                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-base-300 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200"
                                            >
                                                Delete
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-xs text-base-content/50">Registered in code</span>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

Taxonomies.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
