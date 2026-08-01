import { type FormEvent, type ReactNode } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, PageHeader } from '@/components/admin/keystone';
import { update as customFieldUpdate } from '@/routes/admin/content-model/custom-fields';
import { FlashCards, TextField, BoolField } from './ContentTypes';
import type { KeystoneSharedProps } from '@/types/keystone';

interface CustomFieldRow {
    id: number;
    name: string;
    key: string;
    type: string;
    column_type: string;
    description: string;
    content_types: string[];
    order: number;
    required: boolean;
    default_value: string;
}

interface Option { slug: string; name: string }
interface FieldType { slug: string; label: string; columnType: string }

interface PageProps extends KeystoneSharedProps {
    customField: CustomFieldRow;
    contentTypes: Option[];
    fieldTypes: FieldType[];
    flash?: { success?: string; warning?: string; error?: string };
    errors?: Record<string, string>;
    [key: string]: unknown;
}

export default function CustomFieldEdit() {
    const { customField, contentTypes, fieldTypes, flash, errors } = usePage<PageProps>().props;
    const form = useForm({
        name: customField.name,
        type: customField.type,
        column_type: customField.column_type,
        description: customField.description,
        content_types: customField.content_types,
        order: String(customField.order ?? ''),
        required: customField.required,
        default_value: customField.default_value,
    });

    function handleTypeChange(slug: string) {
        const match = fieldTypes.find((ft) => ft.slug === slug);
        form.setData('type', slug);
        if (match) form.setData('column_type', match.columnType);
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            order: data.order === '' ? null : Number(data.order),
        }));
        form.put(customFieldUpdate(customField.id).url, { preserveScroll: true });
    }

    return (
        <>
            <Head title={`Edit ${customField.name}`} />
            <div className="flex flex-col gap-7">
                <PageHeader title={`Edit ${customField.name}`} description={`Key: ${customField.key}`} breadcrumbs={['Content Model', 'Custom Fields', 'Edit']} />
                <FlashCards flash={flash} errors={errors} />
                <Card>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <TextField label="Name" value={form.data.name} onChange={(v) => form.setData('name', v)} error={form.errors.name} required />
                        <div>
                            <label className="text-xs font-semibold text-base-content/60">Field type *</label>
                            <select value={form.data.type} onChange={(e) => handleTypeChange(e.target.value)} className="mt-1 block w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm">
                                {fieldTypes.map((ft) => (
                                    <option key={ft.slug} value={ft.slug}>{ft.label}</option>
                                ))}
                            </select>
                            {form.errors.type ? <div className="mt-1 text-xs text-error">{form.errors.type}</div> : null}
                        </div>
                        <TextField label="Column type" value={form.data.column_type} onChange={(v) => form.setData('column_type', v)} error={form.errors.column_type} />
                        <TextField label="Default value" value={form.data.default_value} onChange={(v) => form.setData('default_value', v)} error={form.errors.default_value} />
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
                        <TextField label="Order" value={form.data.order} onChange={(v) => form.setData('order', v)} error={form.errors.order} type="number" />
                        <TextField label="Description" value={form.data.description} onChange={(v) => form.setData('description', v)} error={form.errors.description} className="md:col-span-2" />
                        <BoolField label="Required" value={form.data.required} onChange={(v) => form.setData('required', v)} />
                        {applyFilters<ReactNode>(
                            // Slot rendered inside the custom-field
                            // definition form so a plugin can inject
                            // extra controls (e.g. per-type editor
                            // settings, a "used by" advisory) alongside
                            // the built-in fields. Starting value is
                            // `null`. Wrap the return in
                            // `<div className="md:col-span-2">` for a
                            // full-width block. Args: `(ReactNode,
                            // { form, customField, mode: 'edit' })`.
                            'keystone.admin.customFields.definition.form',
                            null,
                            { form, customField, mode: 'edit' },
                        )}
                        <div className="md:col-span-2 flex items-center gap-2">
                            <button type="submit" disabled={form.processing} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90 disabled:opacity-50">
                                {form.processing ? 'Saving…' : 'Save changes'}
                            </button>
                        </div>
                    </form>
                </Card>
            </div>
        </>
    );
}

CustomFieldEdit.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
