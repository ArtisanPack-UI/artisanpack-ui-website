import { type FormEvent, type ReactNode } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, PageHeader } from '@/components/admin/keystone';
import { update as taxonomyUpdate } from '@/routes/admin/content-model/taxonomies';
import { FlashCards, TextField, BoolField } from './ContentTypes';
import type { KeystoneSharedProps } from '@/types/keystone';

interface TaxonomyRow {
    slug: string;
    name: string;
    content_type_slug: string;
    description: string;
    hierarchical: boolean;
    show_in_admin: boolean;
    rest_base: string;
}

interface ContentTypeOption { slug: string; name: string }

interface PageProps extends KeystoneSharedProps {
    taxonomy: TaxonomyRow;
    contentTypes: ContentTypeOption[];
    flash?: { success?: string; warning?: string; error?: string };
    errors?: Record<string, string>;
    [key: string]: unknown;
}

export default function TaxonomyEdit() {
    const { taxonomy, contentTypes, flash, errors } = usePage<PageProps>().props;
    const form = useForm({
        name: taxonomy.name,
        content_type_slug: taxonomy.content_type_slug,
        description: taxonomy.description,
        hierarchical: taxonomy.hierarchical,
        show_in_admin: taxonomy.show_in_admin,
        rest_base: taxonomy.rest_base,
    });

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        form.put(taxonomyUpdate(taxonomy.slug).url, { preserveScroll: true });
    }

    return (
        <>
            <Head title={`Edit ${taxonomy.name}`} />
            <div className="flex flex-col gap-7">
                <PageHeader title={`Edit ${taxonomy.name}`} description={`Slug: ${taxonomy.slug}`} breadcrumbs={['Content Model', 'Taxonomies', 'Edit']} />
                <FlashCards flash={flash} errors={errors} />
                <Card>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <TextField label="Name" value={form.data.name} onChange={(v) => form.setData('name', v)} error={form.errors.name} required />
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
                            <button type="submit" disabled={form.processing} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary-hover disabled:opacity-50">
                                {form.processing ? 'Saving…' : 'Save changes'}
                            </button>
                        </div>
                    </form>
                </Card>
            </div>
        </>
    );
}

TaxonomyEdit.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
