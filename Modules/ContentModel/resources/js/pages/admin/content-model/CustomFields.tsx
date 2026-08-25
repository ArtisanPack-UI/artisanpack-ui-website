import { useState, type FormEvent, type ReactNode } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, EmptyState, PageHeader } from '@/components/admin/keystone';
import {
    destroy as customFieldDestroy,
    edit as customFieldEdit,
    store as customFieldStore,
} from '@/routes/admin/content-model/custom-fields';
import { FlashCards, TextField, BoolField } from './ContentTypes';
import type { KeystoneSharedProps } from '@/types/keystone';

interface CustomFieldRow {
    id: number | null;
    name: string;
    key: string;
    type: string;
    column_type: string;
    description: string;
    content_types: string[];
    options: Record<string, unknown>;
    order: number;
    required: boolean;
    default_value: string;
    is_editable: boolean;
}

interface Option { slug: string; name: string }
interface FieldType { slug: string; label: string; columnType: string }

interface PageProps extends KeystoneSharedProps {
    customFields: CustomFieldRow[];
    contentTypes: Option[];
    fieldTypes: FieldType[];
    flash?: { success?: string; warning?: string; error?: string };
    errors?: Record<string, string>;
    [key: string]: unknown;
}

export default function CustomFields() {
    const { customFields, contentTypes, fieldTypes, flash, errors } = usePage<PageProps>().props;
    const [showCreate, setShowCreate] = useState(false);

    const form = useForm({
        name: '',
        key: '',
        type: fieldTypes[0]?.slug ?? 'text',
        column_type: fieldTypes[0]?.columnType ?? 'string',
        description: '',
        content_types: [] as string[],
        order: '',
        required: false,
        default_value: '',
    });

    function handleTypeChange(slug: string) {
        const match = fieldTypes.find((ft) => ft.slug === slug);
        form.setData('type', slug);
        if (match) form.setData('column_type', match.columnType);
    }

    function handleCreate(event: FormEvent) {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            order: data.order === '' ? null : Number(data.order),
        }));
        form.post(customFieldStore().url, {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setShowCreate(false);
            },
        });
    }

    function handleDelete(row: CustomFieldRow) {
        if (!row.is_editable || !row.id) return;
        if (!confirm(`Remove custom field "${row.name}"? The underlying columns will be dropped from ${row.content_types.length} content type(s).`)) return;
        router.delete(customFieldDestroy(row.id).url, { preserveScroll: true });
    }

    return (
        <>
            <Head title="Custom Fields" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Custom Fields"
                    description="Add fields to content types beyond the built-in ones."
                    breadcrumbs={['Content Model', 'Custom Fields']}
                    actions={
                        <button
                            type="button"
                            onClick={() => setShowCreate((v) => !v)}
                            disabled={contentTypes.length === 0}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary-hover disabled:opacity-50"
                            title={contentTypes.length === 0 ? 'Create a content type first' : undefined}
                        >
                            {showCreate ? 'Cancel' : 'New custom field'}
                        </button>
                    }
                />

                <FlashCards flash={flash} errors={errors} />

                {showCreate ? (
                    <Card>
                        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <TextField label="Name" value={form.data.name} onChange={(v) => form.setData('name', v)} error={form.errors.name} required />
                            <TextField label="Key" value={form.data.key} onChange={(v) => form.setData('key', v)} error={form.errors.key} placeholder="seo_description" required hint="lowercase, underscores only" />
                            <div>
                                <label className="text-xs font-semibold text-base-content/60">Field type *</label>
                                <select value={form.data.type} onChange={(e) => handleTypeChange(e.target.value)} className="mt-1 block w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm">
                                    {fieldTypes.map((ft) => (
                                        <option key={ft.slug} value={ft.slug}>{ft.label}</option>
                                    ))}
                                </select>
                                {form.errors.type ? <div className="mt-1 text-xs text-error">{form.errors.type}</div> : null}
                            </div>
                            <TextField label="Column type" value={form.data.column_type} onChange={(v) => form.setData('column_type', v)} error={form.errors.column_type} hint="Auto-set from field type" />
                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold text-base-content/60">Content types *</label>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    {contentTypes.map((ct) => (
                                        <label key={ct.slug} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-base-300 px-2.5 py-1.5 text-xs">
                                            <input
                                                type="checkbox"
                                                checked={form.data.content_types.includes(ct.slug)}
                                                onChange={(e) => {
                                                    const next = e.target.checked
                                                        ? [...form.data.content_types, ct.slug]
                                                        : form.data.content_types.filter((s) => s !== ct.slug);
                                                    form.setData('content_types', next);
                                                }}
                                            />
                                            {ct.name}
                                        </label>
                                    ))}
                                </div>
                                {form.errors.content_types ? <div className="mt-1 text-xs text-error">{form.errors.content_types}</div> : null}
                            </div>
                            <TextField label="Default value" value={form.data.default_value} onChange={(v) => form.setData('default_value', v)} error={form.errors.default_value} />
                            <TextField label="Order" value={form.data.order} onChange={(v) => form.setData('order', v)} error={form.errors.order} type="number" />
                            <TextField label="Description" value={form.data.description} onChange={(v) => form.setData('description', v)} error={form.errors.description} className="md:col-span-2" />
                            <BoolField label="Required" value={form.data.required} onChange={(v) => form.setData('required', v)} />
                            <div className="md:col-span-2 flex items-center gap-2">
                                <button type="submit" disabled={form.processing} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary-hover disabled:opacity-50">
                                    {form.processing ? 'Creating…' : 'Create custom field'}
                                </button>
                            </div>
                        </form>
                    </Card>
                ) : null}

                {customFields.length === 0 ? (
                    <Card>
                        <EmptyState title="No custom fields" description="Add a custom field to extend a content type." />
                    </Card>
                ) : (
                    <div className="grid grid-cols-12 gap-7">
                        {customFields.map((row) => (
                            <Card key={row.key} className="col-span-12 md:col-span-6 xl:col-span-4 flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-display text-base font-semibold text-base-content">{row.name}</div>
                                        <div className="text-xs text-base-content/55 font-mono">{row.key} · {row.type}</div>
                                    </div>
                                    {row.is_editable ? null : (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-base-300 bg-base-200/60 px-2 py-0.5 text-[11px] font-semibold text-base-content/60">
                                            Registered
                                        </span>
                                    )}
                                </div>
                                {row.description ? <div className="text-sm text-base-content/65">{row.description}</div> : null}
                                <div className="text-xs text-base-content/55">
                                    {row.content_types.length > 0 ? row.content_types.join(', ') : 'no content types'}
                                </div>
                                <div className="mt-auto flex flex-wrap items-center gap-2">
                                    {row.is_editable && row.id ? (
                                        <>
                                            <Link
                                                href={customFieldEdit(row.id).url}
                                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-base-300 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200"
                                            >
                                                Edit
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(row)}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-base-300 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200"
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

CustomFields.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
