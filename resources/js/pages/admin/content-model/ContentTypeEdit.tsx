import { type FormEvent, type ReactNode } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, PageHeader } from '@/components/admin/keystone';
import { update as contentTypeUpdate } from '@/routes/admin/content-model/content-types';
import { FlashCards, TextField, BoolField } from './ContentTypes';
import type { KeystoneSharedProps } from '@/types/keystone';

interface ContentTypeRow {
    slug: string;
    name: string;
    description: string;
    icon: string;
    menu_position: number | null;
    public: boolean;
    show_in_admin: boolean;
    hierarchical: boolean;
    has_archive: boolean;
    archive_slug: string;
    supports: string[];
}

interface PageProps extends KeystoneSharedProps {
    contentType: ContentTypeRow;
    supportsOptions: string[];
    iconOptions: string[];
    flash?: { success?: string; warning?: string; error?: string };
    errors?: Record<string, string>;
    [key: string]: unknown;
}

export default function ContentTypeEdit() {
    const { contentType, supportsOptions, iconOptions, flash, errors } = usePage<PageProps>().props;
    const form = useForm({
        name: contentType.name,
        description: contentType.description,
        icon: contentType.icon,
        menu_position: contentType.menu_position === null ? '' : String(contentType.menu_position),
        public: contentType.public,
        show_in_admin: contentType.show_in_admin,
        hierarchical: contentType.hierarchical,
        has_archive: contentType.has_archive,
        archive_slug: contentType.archive_slug,
        supports: contentType.supports,
    });

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            menu_position: data.menu_position === '' ? null : Number(data.menu_position),
        }));
        form.put(contentTypeUpdate(contentType.slug).url, { preserveScroll: true });
    }

    return (
        <>
            <Head title={`Edit ${contentType.name}`} />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title={`Edit ${contentType.name}`}
                    description={`Slug: ${contentType.slug}`}
                    breadcrumbs={['Content Model', 'Content Types', 'Edit']}
                />
                <FlashCards flash={flash} errors={errors} />
                <Card>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <TextField label="Name" value={form.data.name} onChange={(v) => form.setData('name', v)} error={form.errors.name} required />
                        <div>
                            <label className="text-xs font-semibold text-base-content/60">Icon</label>
                            <select value={form.data.icon} onChange={(e) => form.setData('icon', e.target.value)} className="mt-1 block w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm">
                                <option value="">Default</option>
                                {iconOptions.map((id) => (
                                    <option key={id} value={id}>{id}</option>
                                ))}
                            </select>
                            {form.errors.icon ? <div className="mt-1 text-xs text-error">{form.errors.icon}</div> : null}
                        </div>
                        <TextField label="Menu position" value={form.data.menu_position} onChange={(v) => form.setData('menu_position', v)} error={form.errors.menu_position} type="number" />
                        <TextField label="Archive slug" value={form.data.archive_slug} onChange={(v) => form.setData('archive_slug', v)} error={form.errors.archive_slug} />
                        <TextField label="Description" value={form.data.description} onChange={(v) => form.setData('description', v)} error={form.errors.description} className="md:col-span-2" />
                        <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-base-content/60">Features</label>
                            <div className="mt-1 flex flex-wrap gap-2">
                                {supportsOptions.map((option) => (
                                    <label key={option} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-base-300 px-2.5 py-1.5 text-xs">
                                        <input
                                            type="checkbox"
                                            checked={form.data.supports.includes(option)}
                                            onChange={(e) => {
                                                const next = e.target.checked
                                                    ? [...form.data.supports, option]
                                                    : form.data.supports.filter((s) => s !== option);
                                                form.setData('supports', next);
                                            }}
                                        />
                                        {option}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <BoolField label="Public" value={form.data.public} onChange={(v) => form.setData('public', v)} />
                        <BoolField label="Show in admin" value={form.data.show_in_admin} onChange={(v) => form.setData('show_in_admin', v)} />
                        <BoolField label="Hierarchical" value={form.data.hierarchical} onChange={(v) => form.setData('hierarchical', v)} />
                        <BoolField label="Has archive" value={form.data.has_archive} onChange={(v) => form.setData('has_archive', v)} />
                        {applyFilters<ReactNode>(
                            // Same slot as the create form; `mode: 'edit'`
                            // lets a subscriber render different controls
                            // during edit (e.g. show a "Rebuild indexes"
                            // button that only makes sense post-create).
                            'keystone.admin.contentTypes.form.sections',
                            null,
                            { form, mode: 'edit', contentType },
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

ContentTypeEdit.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
