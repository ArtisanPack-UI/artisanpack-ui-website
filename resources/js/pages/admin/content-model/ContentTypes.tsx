import { useState, type FormEvent, type ReactNode } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, EmptyState, PageHeader } from '@/components/admin/keystone';
import {
    destroy as contentTypeDestroy,
    edit as contentTypeEdit,
    store as contentTypeStore,
} from '@/routes/admin/content-model/content-types';
import type { KeystoneSharedProps } from '@/types/keystone';

interface ContentTypeRow {
    id: number | null;
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
    table_name: string;
    model_class: string;
    is_editable: boolean;
}

interface PageProps extends KeystoneSharedProps {
    contentTypes: ContentTypeRow[];
    supportsOptions: string[];
    iconOptions: string[];
    flash?: { success?: string; warning?: string; error?: string };
    errors?: Record<string, string>;
    [key: string]: unknown;
}

interface CreateForm {
    name: string;
    slug: string;
    description: string;
    icon: string;
    menu_position: string;
    public: boolean;
    show_in_admin: boolean;
    hierarchical: boolean;
    has_archive: boolean;
    archive_slug: string;
    supports: string[];
}

const INITIAL_CREATE: CreateForm = {
    name: '',
    slug: '',
    description: '',
    icon: '',
    menu_position: '',
    public: true,
    show_in_admin: true,
    hierarchical: false,
    has_archive: true,
    archive_slug: '',
    // `editor`, not `content`: the framework's `SupportsFeature` enum —
    // which is what `supports.*` validates against — renamed the block-
    // content flag to `editor`. Leaving `content` here meant the create
    // form's *default* payload failed validation, so a user who didn't
    // touch the feature checkboxes could not create a content type at all.
    supports: ['title', 'editor'],
};

export default function ContentTypes() {
    const { contentTypes, supportsOptions, iconOptions, flash, errors } = usePage<PageProps>().props;
    const [showCreate, setShowCreate] = useState(false);

    const form = useForm<CreateForm>({ ...INITIAL_CREATE });

    function handleCreate(event: FormEvent) {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            menu_position: data.menu_position === '' ? null : Number(data.menu_position),
        }));
        form.post(contentTypeStore().url, {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setShowCreate(false);
            },
        });
    }

    function handleDelete(row: ContentTypeRow) {
        if (!row.is_editable) return;
        if (!confirm(`Remove content type "${row.name}"? Existing records in "${row.table_name}" will not be dropped.`)) return;
        router.delete(contentTypeDestroy(row.slug).url, { preserveScroll: true });
    }

    return (
        <>
            <Head title="Content Types" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Content Types"
                    description="Register content types admins can create records against."
                    breadcrumbs={['Content Model', 'Content Types']}
                    actions={
                        <button
                            type="button"
                            onClick={() => setShowCreate((v) => !v)}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90"
                        >
                            {showCreate ? 'Cancel' : 'New content type'}
                        </button>
                    }
                />

                <FlashCards flash={flash} errors={errors} />

                {showCreate ? (
                    <Card>
                        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <TextField label="Name" value={form.data.name} onChange={(v) => form.setData('name', v)} error={form.errors.name} required />
                            <TextField label="Slug" value={form.data.slug} onChange={(v) => form.setData('slug', v)} error={form.errors.slug} placeholder="portfolio" required hint="lowercase, hyphens only" />
                            <div className="md:col-span-1">
                                <label className="text-xs font-semibold text-base-content/60">Icon</label>
                                <select value={form.data.icon} onChange={(e) => form.setData('icon', e.target.value)} className="mt-1 block w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm">
                                    <option value="">Default</option>
                                    {iconOptions.map((id) => (
                                        <option key={id} value={id}>{id}</option>
                                    ))}
                                </select>
                                {form.errors.icon ? <div className="mt-1 text-xs text-error">{form.errors.icon}</div> : null}
                            </div>
                            <TextField label="Menu position" value={form.data.menu_position} onChange={(v) => form.setData('menu_position', v)} error={form.errors.menu_position} type="number" className="md:col-span-1" />
                            <TextField label="Description" value={form.data.description} onChange={(v) => form.setData('description', v)} error={form.errors.description} className="md:col-span-2" />
                            <TextField label="Archive slug" value={form.data.archive_slug} onChange={(v) => form.setData('archive_slug', v)} error={form.errors.archive_slug} className="md:col-span-2" />
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
                                // Slot rendered inside the create form so a
                                // plugin can inject additional field groups
                                // (e.g. custom endpoint slugs, workflow
                                // toggles) without forking this page. The
                                // starting value is `null`; wrap the return
                                // in `<div className="md:col-span-2">` if
                                // you want a full-width section. Args:
                                // `(ReactNode, { form, mode: 'create' })`.
                                'keystone.admin.contentTypes.form.sections',
                                null,
                                { form, mode: 'create' },
                            )}
                            <div className="md:col-span-2 flex items-center gap-2">
                                <button type="submit" disabled={form.processing} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90 disabled:opacity-50">
                                    {form.processing ? 'Creating…' : 'Create content type'}
                                </button>
                            </div>
                        </form>
                    </Card>
                ) : null}

                {contentTypes.length === 0 ? (
                    <Card>
                        <EmptyState title="No content types" description="Create a content type to model your content." />
                    </Card>
                ) : (
                    <div className="grid grid-cols-12 gap-7">
                        {contentTypes.map((row) => (
                            <Card key={row.slug} className="col-span-12 md:col-span-6 xl:col-span-4 flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-display text-base font-semibold text-base-content">{row.name}</div>
                                        <div className="text-xs text-base-content/55 font-mono">{row.slug}</div>
                                    </div>
                                    {row.is_editable ? null : (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-base-300 bg-base-200/60 px-2 py-0.5 text-[11px] font-semibold text-base-content/60">
                                            Registered
                                        </span>
                                    )}
                                </div>
                                {row.description ? <div className="text-sm text-base-content/65">{row.description}</div> : null}
                                <div className="text-xs text-base-content/55">
                                    {row.supports.length > 0 ? row.supports.join(', ') : 'no features'}
                                </div>
                                <div className="mt-auto flex flex-wrap items-center gap-2">
                                    {applyFilters<ReactNode>(
                                        // Route the trailing action row through
                                        // `.contentTypes.actions` so a plugin can
                                        // add "Duplicate", "Export JSON", or
                                        // gate the built-in Edit / Delete
                                        // behind a permission check. Args:
                                        // `(ReactNode, { contentType })`.
                                        'keystone.admin.contentTypes.actions',
                                        row.is_editable ? (
                                            <>
                                                <Link
                                                    href={contentTypeEdit(row.slug).url}
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
                                        ),
                                        { contentType: row },
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

export function FlashCards({ flash, errors }: { flash?: { success?: string; warning?: string; error?: string }; errors?: Record<string, string> }) {
    return (
        <>
            {flash?.success ? <Card className="border-success/30 bg-success/5 text-sm text-success">{flash.success}</Card> : null}
            {flash?.warning ? <Card className="border-warning/30 bg-warning/5 text-sm text-warning">{flash.warning}</Card> : null}
            {flash?.error ? <Card role="alert" className="border-error/40 bg-error/5 text-sm text-error">{flash.error}</Card> : null}
            {errors && Object.values(errors).length > 0 && !flash?.error ? (
                <Card role="alert" className="border-error/40 bg-error/5 text-sm text-error">
                    <ul className="list-disc pl-5">
                        {Object.entries(errors).map(([key, message]) => (
                            <li key={key}>{message}</li>
                        ))}
                    </ul>
                </Card>
            ) : null}
        </>
    );
}

export function TextField({ label, value, onChange, error, required, hint, placeholder, type = 'text', className = '' }: { label: string; value: string; onChange: (v: string) => void; error?: string; required?: boolean; hint?: string; placeholder?: string; type?: string; className?: string }) {
    return (
        <div className={className}>
            <label className="text-xs font-semibold text-base-content/60">{label}{required ? ' *' : ''}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="mt-1 block w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm"
            />
            {hint ? <div className="mt-1 text-[11px] text-base-content/50">{hint}</div> : null}
            {error ? <div className="mt-1 text-xs text-error">{error}</div> : null}
        </div>
    );
}

export function BoolField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-base-content/80">
            <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
            {label}
        </label>
    );
}

ContentTypes.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
