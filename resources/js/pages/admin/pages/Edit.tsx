import { useState, type FormEvent, type ReactNode } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Icon, PageHeader } from '@/components/admin/keystone';
import CollapsibleCard from '@/components/admin/CollapsibleCard';
import FeaturedImagePicker, {
    type FeaturedImageRecord,
} from '@/components/admin/FeaturedImagePicker';
import SeoMetaCard, { type SeoMetaForm } from '@/components/admin/SeoMetaCard';
import VisualEditor from '@/components/admin/VisualEditor';
import CustomFieldsSection from '@/components/admin/custom-fields/CustomFieldsSection';
import { mergeCustomFieldValues } from '@/components/admin/custom-fields/mergeValues';
import type { CustomFieldRecord } from '@/components/admin/custom-fields/types';
import AdminEditSlot from '@/components/admin/panels/AdminEditSlot';
import { destroy, index, update } from '@/routes/admin/pages';

interface StatusOption {
    value: 'draft' | 'published' | 'scheduled';
    label: string;
}

interface ParentOption {
    value: number;
    label: string;
}

interface AdminPage {
    id: number;
    title: string;
    slug: string;
    status: StatusOption['value'];
    excerpt: string | null;
    template: string | null;
    parent_id: number | null;
    order: number;
    author: string | null;
    updated_at: string | null;
    featured_image: FeaturedImageRecord | null;
    seo: SeoMetaForm;
}

interface PageProps {
    page: AdminPage;
    statuses: StatusOption[];
    parentOptions: ParentOption[];
    customFields: CustomFieldRecord[];
    errors: Record<string, string>;
    flash?: { success?: string; error?: string };
    [key: string]: unknown;
}

export default function Edit() {
    const { page, statuses, parentOptions, customFields, errors, flash } =
        usePage<PageProps>().props;
    const [form, setForm] = useState({
        title: page.title,
        slug: page.slug,
        status: page.status,
        excerpt: page.excerpt ?? '',
        template: page.template ?? '',
        parent_id: page.parent_id,
        order: page.order,
        featured_image: page.featured_image,
        seo: page.seo,
        custom_fields: {} as Record<string, unknown>,
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        // Inertia's FormDataConvertible covers primitives and arrays of
        // primitives. `featured_image` is the picker's local hydration
        // record, so we replace it with `featured_image_id` on submit.
        // The SEO sub-form's image pickers are reshaped the same way.
        const { featured_image: _featuredImage, seo, custom_fields, ...rest } = form;
        router.put(update(page.id).url, {
            ...rest,
            featured_image_id: form.featured_image?.id ?? null,
            seo: serializeSeo(seo),
            custom_fields: mergeCustomFieldValues(customFields, custom_fields),
        });
    }

    function handleDelete() {
        if (!confirm(`Delete "${page.title}"? This cannot be undone.`)) return;
        router.delete(destroy(page.id).url);
    }

    const parentLabel =
        parentOptions.find((p) => p.value === form.parent_id)?.label ??
        'No parent';
    const attributesSummary = [
        parentLabel,
        form.template || 'default template',
        `order ${form.order}`,
    ].join(' · ');

    return (
        <>
            <Head title={`Edit ${page.title}`} />
            <form onSubmit={submit} className="flex flex-col gap-4">
                <PageHeader
                    title={page.title || 'Untitled page'}
                    description={`/${page.slug}`}
                    breadcrumbs={['Pages', page.title || 'Untitled']}
                    actions={
                        <div className="flex items-center gap-2">
                            <Link
                                href={index().url}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200"
                            >
                                Back
                            </Link>
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-error/30 bg-base-100 px-3 py-2 text-xs font-semibold text-error hover:bg-error/10"
                            >
                                Delete
                            </button>
                            <button
                                type="submit"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90"
                            >
                                {Icon.edit}
                                Save changes
                            </button>
                        </div>
                    }
                />

                {flash?.success && (
                    <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
                        {flash.success}
                    </div>
                )}

                <AdminEditSlot
                    slot="tabs"
                    contentType="pages"
                    record={page as unknown as Record<string, unknown>}
                />
                <AdminEditSlot
                    slot="sidebar-top"
                    contentType="pages"
                    record={page as unknown as Record<string, unknown>}
                />

                <CollapsibleCard title="Content" defaultOpen>
                    <div className="grid gap-5 md:grid-cols-2">
                        <Field
                            label="Title"
                            error={errors.title}
                            input={
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) =>
                                        setForm({ ...form, title: e.target.value })
                                    }
                                    className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary"
                                />
                            }
                        />
                        <Field
                            label="Slug"
                            error={errors.slug}
                            input={
                                <input
                                    type="text"
                                    value={form.slug}
                                    onChange={(e) =>
                                        setForm({ ...form, slug: e.target.value })
                                    }
                                    className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 font-mono text-sm outline-none focus:border-primary"
                                />
                            }
                        />
                        <div className="md:col-span-2">
                            <Field
                                label="Excerpt"
                                hint="Short summary shown in listings and meta tags."
                                error={errors.excerpt}
                                input={
                                    <textarea
                                        rows={3}
                                        value={form.excerpt}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                excerpt: e.target.value,
                                            })
                                        }
                                        className="w-full rounded-md border border-base-300/60 bg-base-100 px-3 py-2 text-sm outline-none focus:border-primary"
                                    />
                                }
                            />
                        </div>
                    </div>
                </CollapsibleCard>

                <CollapsibleCard
                    title="Publishing"
                    summary={`${form.status} · ${page.author ?? '—'}`}
                    defaultOpen
                >
                    <div className="grid gap-5 md:grid-cols-2">
                        <Field
                            label="Status"
                            error={errors.status}
                            input={
                                <select
                                    value={form.status}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            status: e.target
                                                .value as StatusOption['value'],
                                        })
                                    }
                                    className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary"
                                >
                                    {statuses.map((s) => (
                                        <option key={s.value} value={s.value}>
                                            {s.label}
                                        </option>
                                    ))}
                                </select>
                            }
                        />
                        <Field
                            label="Author"
                            input={
                                <div className="flex h-9 items-center rounded-md border border-base-300/60 bg-base-200/40 px-3 text-sm text-base-content/65">
                                    {page.author ?? '—'}
                                </div>
                            }
                        />
                    </div>
                </CollapsibleCard>

                <CollapsibleCard
                    title="Featured image"
                    summary={form.featured_image?.title ?? (form.featured_image ? 'Image set' : 'No image set')}
                    defaultOpen
                >
                    <FeaturedImagePicker
                        value={form.featured_image}
                        onChange={(next) => setForm({ ...form, featured_image: next })}
                        context={`page-${page.id}`}
                    />
                </CollapsibleCard>

                <SeoMetaCard
                    value={form.seo}
                    onChange={(next) => setForm({ ...form, seo: next })}
                    errors={errors as unknown as Record<string, string>}
                    contextPrefix={`page-${page.id}`}
                />


                <CollapsibleCard title="Attributes" summary={attributesSummary}>
                    <div className="grid gap-5 md:grid-cols-2">
                        <Field
                            label="Parent page"
                            hint="Choose a parent to nest this page in the hierarchy."
                            error={errors.parent_id}
                            input={
                                <select
                                    value={form.parent_id ?? ''}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            parent_id: e.target.value
                                                ? Number(e.target.value)
                                                : null,
                                        })
                                    }
                                    className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary"
                                >
                                    <option value="">— No parent —</option>
                                    {parentOptions.map((p) => (
                                        <option key={p.value} value={p.value}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>
                            }
                        />
                        <Field
                            label="Template"
                            hint="Theme template slug to render this page with."
                            error={errors.template}
                            input={
                                <input
                                    type="text"
                                    value={form.template}
                                    onChange={(e) =>
                                        setForm({ ...form, template: e.target.value })
                                    }
                                    placeholder="default"
                                    className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 font-mono text-sm outline-none focus:border-primary"
                                />
                            }
                        />
                        <Field
                            label="Menu order"
                            hint="Lower numbers sort first."
                            error={errors.order}
                            input={
                                <input
                                    type="number"
                                    min={0}
                                    value={form.order}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            order: Number(e.target.value),
                                        })
                                    }
                                    className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary"
                                />
                            }
                        />
                    </div>
                </CollapsibleCard>

                <CustomFieldsSection
                    fields={customFields}
                    values={form.custom_fields}
                    errors={errors as unknown as Record<string, string>}
                    onChange={(key, value) =>
                        setForm((f) => ({
                            ...f,
                            custom_fields: { ...f.custom_fields, [key]: value },
                        }))
                    }
                />

                <AdminEditSlot
                    slot="sidebar-bottom"
                    contentType="pages"
                    record={page as unknown as Record<string, unknown>}
                />

                <AdminEditSlot
                    slot="before-editor"
                    contentType="pages"
                    record={page as unknown as Record<string, unknown>}
                />

                <VisualEditor
                    resource="pages"
                    id={page.id}
                    initialTitle={page.title}
                    initialSlug={page.slug}
                    initialStatus={page.status}
                    supports={{ title: false, document: false }}
                />

                <AdminEditSlot
                    slot="after-editor"
                    contentType="pages"
                    record={page as unknown as Record<string, unknown>}
                />
            </form>
        </>
    );
}

function Field({
    label,
    error,
    hint,
    input,
}: {
    label: string;
    error?: string;
    hint?: string;
    input: ReactNode;
}) {
    return (
        <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-base-content/85">{label}</span>
            {input}
            {hint && !error && (
                <span className="text-xs text-base-content/55">{hint}</span>
            )}
            {error && <span className="text-xs text-error">{error}</span>}
        </label>
    );
}

/**
 * Reshape the SEO sub-form into the payload the server validator
 * expects: the picker's hydration records (`og_image`, `twitter_image`)
 * collapse to `*_id` fields, everything else passes through as-is.
 */
function serializeSeo(seo: SeoMetaForm) {
    const { og_image, twitter_image, ...rest } = seo;
    return {
        ...rest,
        og_image_id: og_image?.id ?? null,
        twitter_image_id: twitter_image?.id ?? null,
    };
}

Edit.layout = (page: ReactNode) => (
    <KeystoneAdminLayout>{page}</KeystoneAdminLayout>
);
