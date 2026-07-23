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
import { destroy, index, update } from '@/routes/admin/posts';
import { store as categoryStore } from '@/routes/admin/posts/categories';
import { store as tagStore } from '@/routes/admin/posts/tags';

interface StatusOption {
    value: 'draft' | 'published' | 'scheduled';
    label: string;
}

interface CategoryOption {
    value: number;
    label: string;
}

interface AdminPost {
    id: number;
    title: string;
    slug: string;
    permalink: string;
    status: StatusOption['value'];
    excerpt: string | null;
    author: string | null;
    category_ids: number[];
    tag_ids: number[];
    published_at: string | null;
    updated_at: string | null;
    featured_image: FeaturedImageRecord | null;
    seo: SeoMetaForm;
}

interface PageProps {
    post: AdminPost;
    statuses: StatusOption[];
    categories: CategoryOption[];
    tags: CategoryOption[];
    customFields: CustomFieldRecord[];
    errors: Record<string, string>;
    flash?: { success?: string; error?: string };
    [key: string]: unknown;
}

export default function Edit() {
    const { post, statuses, categories, tags, customFields, errors, flash } =
        usePage<PageProps>().props;
    const [form, setForm] = useState({
        title: post.title,
        slug: post.slug,
        status: post.status,
        excerpt: post.excerpt ?? '',
        category_ids: post.category_ids,
        tag_ids: post.tag_ids,
        featured_image: post.featured_image,
        seo: post.seo,
        custom_fields: {} as Record<string, unknown>,
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        // Inertia's FormDataConvertible covers primitives and arrays of
        // primitives. `featured_image` is the picker's local hydration
        // record, so we replace it with `featured_image_id` on submit.
        // The SEO sub-form's image pickers are reshaped the same way.
        const { featured_image: _featuredImage, seo, custom_fields, ...rest } = form;
        router.put(update(post.id).url, {
            ...rest,
            featured_image_id: form.featured_image?.id ?? null,
            seo: serializeSeo(seo),
            custom_fields: mergeCustomFieldValues(customFields, custom_fields),
        });
    }

    function handleDelete() {
        if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
        router.delete(destroy(post.id).url);
    }

    function toggleCategory(id: number) {
        setForm((f) => ({
            ...f,
            category_ids: f.category_ids.includes(id)
                ? f.category_ids.filter((c) => c !== id)
                : [...f.category_ids, id],
        }));
    }

    function toggleTag(id: number) {
        setForm((f) => ({
            ...f,
            tag_ids: f.tag_ids.includes(id)
                ? f.tag_ids.filter((t) => t !== id)
                : [...f.tag_ids, id],
        }));
    }

    const categorySummary =
        form.category_ids.length === 0
            ? 'Uncategorized'
            : categories
                  .filter((c) => form.category_ids.includes(c.value))
                  .map((c) => c.label)
                  .join(', ');

    const tagSummary =
        form.tag_ids.length === 0
            ? 'No tags'
            : tags
                  .filter((t) => form.tag_ids.includes(t.value))
                  .map((t) => t.label)
                  .join(', ');

    return (
        <>
            <Head title={`Edit ${post.title}`} />
            <form onSubmit={submit} className="flex flex-col gap-4">
                <PageHeader
                    title={post.title || 'Untitled post'}
                    description={post.permalink}
                    breadcrumbs={['Blog Posts', post.title || 'Untitled']}
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
                    contentType="posts"
                    record={post as unknown as Record<string, unknown>}
                />
                <AdminEditSlot
                    slot="sidebar-top"
                    contentType="posts"
                    record={post as unknown as Record<string, unknown>}
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
                    summary={`${form.status} · ${post.author ?? '—'}`}
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
                                    {post.author ?? '—'}
                                </div>
                            }
                        />
                    </div>
                </CollapsibleCard>

                <CollapsibleCard
                    title="Taxonomies"
                    summary={[categorySummary, tagSummary].join(' · ')}
                    defaultOpen
                >
                    <div className="grid gap-5 sm:grid-cols-2">
                        <TaxonomyPicker
                            label="Categories"
                            createLabel="Add new category"
                            emptyLabel="No categories yet"
                            emptyHint="Create the first category below to start organizing posts."
                            options={categories}
                            selected={form.category_ids}
                            onToggle={toggleCategory}
                            createUrl={categoryStore().url}
                            createError={errors.name}
                        />
                        <TaxonomyPicker
                            label="Tags"
                            createLabel="Add new tag"
                            emptyLabel="No tags yet"
                            emptyHint="Create the first tag below to label posts."
                            options={tags}
                            selected={form.tag_ids}
                            onToggle={toggleTag}
                            createUrl={tagStore().url}
                            createError={errors.name}
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
                        context={`post-${post.id}`}
                    />
                </CollapsibleCard>

                <SeoMetaCard
                    value={form.seo}
                    onChange={(next) => setForm({ ...form, seo: next })}
                    errors={errors as unknown as Record<string, string>}
                    contextPrefix={`post-${post.id}`}
                />

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
                    contentType="posts"
                    record={post as unknown as Record<string, unknown>}
                />

                <AdminEditSlot
                    slot="before-editor"
                    contentType="posts"
                    record={post as unknown as Record<string, unknown>}
                />

                <VisualEditor
                    resource="posts"
                    id={post.id}
                    initialTitle={post.title}
                    initialSlug={post.slug}
                    initialStatus={post.status}
                    supports={{ title: false, document: false }}
                />

                <AdminEditSlot
                    slot="after-editor"
                    contentType="posts"
                    record={post as unknown as Record<string, unknown>}
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

function PlaceholderPanel({ label, hint }: { label: string; hint: string }) {
    return (
        <div className="rounded-lg border border-dashed border-base-300 bg-base-200/30 px-5 py-6 text-center">
            <div className="text-sm font-semibold text-base-content/75">
                {label}
            </div>
            <div className="mt-1 text-xs text-base-content/55">{hint}</div>
        </div>
    );
}

interface TaxonomyOption {
    value: number;
    label: string;
}

function TaxonomyPicker({
    label,
    createLabel,
    emptyLabel,
    emptyHint,
    options,
    selected,
    onToggle,
    createUrl,
    createError,
}: {
    label: string;
    createLabel: string;
    emptyLabel: string;
    emptyHint: string;
    options: TaxonomyOption[];
    selected: number[];
    onToggle: (id: number) => void;
    createUrl: string;
    createError?: string;
}) {
    const [creating, setCreating] = useState(false);
    const [draftName, setDraftName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // HTML doesn't allow nested <form>s, and this picker lives inside the
    // outer post-update form. Wrap the inline create UI in a <div> and
    // handle "submit on Enter" with an explicit keydown handler so the
    // Enter keypress never bubbles up to the parent form.
    function submitCreate() {
        const name = draftName.trim();
        if (name === '' || submitting) return;
        setSubmitting(true);
        router.post(
            createUrl,
            { name },
            {
                // Stay on the post Edit screen with all in-progress changes
                // intact. The store action returns `back()` so the response
                // re-renders this same page with refreshed taxonomy props.
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setDraftName('');
                    setCreating(false);
                },
                onFinish: () => setSubmitting(false),
            },
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold tracking-wide text-base-content/65 uppercase">
                    {label}
                </div>
                {!creating && (
                    <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className="text-[11px] font-semibold text-primary hover:underline"
                    >
                        + {createLabel}
                    </button>
                )}
            </div>
            {options.length === 0 ? (
                <PlaceholderPanel label={emptyLabel} hint={emptyHint} />
            ) : (
                <div className="flex flex-wrap gap-1.5">
                    {options.map((o) => {
                        const active = selected.includes(o.value);
                        return (
                            <button
                                key={o.value}
                                type="button"
                                onClick={() => onToggle(o.value)}
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                                    active
                                        ? 'border-primary bg-primary text-primary-content'
                                        : 'border-base-300/60 bg-base-100 text-base-content/65 hover:bg-base-200'
                                }`}
                            >
                                {o.label}
                            </button>
                        );
                    })}
                </div>
            )}
            {creating && (
                <div className="mt-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                        <input
                            type="text"
                            autoFocus
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    // Stop the Enter keypress from bubbling
                                    // to the outer post-update form.
                                    e.preventDefault();
                                    e.stopPropagation();
                                    submitCreate();
                                } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setCreating(false);
                                    setDraftName('');
                                }
                            }}
                            placeholder="Name"
                            className="h-8 flex-1 rounded-md border border-base-300/60 bg-base-100 px-2.5 text-sm outline-none focus:border-primary"
                        />
                        <button
                            type="button"
                            onClick={submitCreate}
                            disabled={submitting || draftName.trim() === ''}
                            className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Add
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setCreating(false);
                                setDraftName('');
                            }}
                            className="rounded-md border border-base-300/60 bg-base-100 px-2.5 py-1 text-xs font-semibold text-base-content/65 hover:bg-base-200"
                        >
                            Cancel
                        </button>
                    </div>
                    {createError && (
                        <div className="text-xs text-error">{createError}</div>
                    )}
                </div>
            )}
        </div>
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
