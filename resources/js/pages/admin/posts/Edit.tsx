import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import {
    applyEditDelete,
    fireEditDeleted,
    fireEditFormError,
    fireEditFormSubmit,
    fireEditFormSuccess,
    useEditFormDirty,
    useEditFormState,
    useEditFormValidate,
    useEditLeaveConfirm,
} from '@/lib/admin/editHooks';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Icon, PageHeader } from '@/components/admin/keystone';
import { type ActualStatus } from '@/components/admin/editor/panels/PublishPanel';
import { type FeaturedImageRecord } from '@/components/admin/FeaturedImagePicker';
import SeoMetaCard, { type SeoMetaForm } from '@/components/admin/SeoMetaCard';
import VisualEditor from '@/components/admin/VisualEditor';
import CustomFieldsSection from '@/components/admin/custom-fields/CustomFieldsSection';
import { mergeCustomFieldValues } from '@/components/admin/custom-fields/mergeValues';
import { keystoneConfirm } from '@/lib/admin/confirm';
import { focusFirstInvalidField } from '@/lib/admin/focusFirstInvalidField';
import type { CustomFieldRecord } from '@/components/admin/custom-fields/types';
import AdminEditSlot from '@/components/admin/panels/AdminEditSlot';
import SlugField from '@/components/admin/SlugField';
import PublishPanel, { type StatusOption } from '@/components/admin/editor/panels/PublishPanel';
import CategoriesPanel from '@/components/admin/editor/panels/CategoriesPanel';
import TagsPanel from '@/components/admin/editor/panels/TagsPanel';
import FeaturedImagePanel from '@/components/admin/editor/panels/FeaturedImagePanel';
import ExcerptPanel from '@/components/admin/editor/panels/ExcerptPanel';
import ScreenOptions from '@/components/admin/editor/ScreenOptions';
import EditorPanelLayout from '@/components/admin/editor/EditorPanelLayout';
import { useEditorLayout } from '@/components/admin/editor/useEditorLayout';
import type { EditorPreferencesPayload } from '@/lib/admin/editorPreferencesApi';
import { destroy, index, slugPreview, update } from '@/routes/admin/posts';
import { store as categoryStore } from '@/routes/admin/posts/categories';
import { store as tagStore } from '@/routes/admin/posts/tags';

interface CategoryOption {
    value: number;
    label: string;
}

interface AdminPost {
    id: number;
    title: string;
    slug: string;
    permalink: string;
    permalink_template: string;
    status: StatusOption['value'];
    actual_status: ActualStatus;
    has_ever_been_published: boolean;
    excerpt: string | null;
    author: string | null;
    category_ids: number[];
    tag_ids: number[];
    published_at: string | null;
    updated_at: string | null;
    featured_image: FeaturedImageRecord | null;
    seo: SeoMetaForm;
    /** Signed, time-limited preview URL. Null when the record type isn't previewable. */
    preview_url: string | null;
}

interface PageProps {
    post: AdminPost;
    statuses: StatusOption[];
    siteTimezone: string;
    categories: CategoryOption[];
    tags: CategoryOption[];
    customFields: CustomFieldRecord[];
    supports: string[];
    /** Per-user, per-post-type panel visibility, order, and collapse state. */
    editorPreferences: EditorPreferencesPayload;
    errors: Record<string, string>;
    flash?: { success?: string; error?: string };
    [key: string]: unknown;
}

export default function Edit() {
    const {
        post,
        statuses,
        siteTimezone,
        categories,
        tags,
        customFields,
        supports,
        editorPreferences,
        errors,
        flash,
    } = usePage<PageProps>().props;
    const has = (flag: string): boolean => flag === 'title' || supports.includes(flag);
    const initialForm = useMemo(
        () => ({
            title: post.title,
            slug: post.slug,
            status: post.status,
            published_at: post.published_at,
            excerpt: post.excerpt ?? '',
            category_ids: post.category_ids,
            tag_ids: post.tag_ids,
            featured_image: post.featured_image,
            seo: post.seo,
            custom_fields: {} as Record<string, unknown>,
        }),
        [post],
    );
    const [form, setForm] = useState(initialForm);
    // Dirty baseline lives in its own state so a successful save can
    // clear the dirty flag (see the `onSuccess` in `submit` below).
    // Without this, `isDirty` would keep comparing against the initial
    // hydration and would stay `true` after PUT because Inertia's
    // PUT/PATCH visits preserve local React state by default and the
    // `custom_fields` slice (server never ships hydration for it) never
    // round-trips back into `initialForm`.
    const [baseline, setBaseline] = useState(initialForm);

    // Fire generic + resource-scoped .edit.form.state per state change,
    // .edit.form.dirty on dirty-flip, and register the leave-confirm
    // warning while the form is dirty. Also route the incoming server
    // error map through the .edit.form.validate filter so plugins can
    // inject client-side validation.
    useEditFormState('posts', post.id, form);
    const isDirty = useMemo(
        () => JSON.stringify(form) !== JSON.stringify(baseline),
        [form, baseline],
    );
    useEditFormDirty('posts', post.id, isDirty);
    useEditLeaveConfirm('posts', post.id, isDirty);
    const filteredErrors = useEditFormValidate('posts', post.id, form, errors);
    // Panels this screen can render at all. `supports` gates what the
    // content type offers; Custom fields drops out on top of that when no
    // field is registered, because the section renders nothing and an
    // empty slot in the layout would still be draggable and listed in
    // Screen Options.
    const availablePanelIds = useMemo(
        () =>
            [
                'publish',
                'categories',
                'tags',
                // No `attributes`: this screen doesn't render
                // `AttributesPanel` at all, so offering it in Screen
                // Options would list a panel that can never appear.
                'featured_image',
                'excerpt',
                'seo',
                customFields.length > 0 ? 'custom_fields' : null,
            ].filter((id): id is string => null !== id),
        [customFields.length],
    );
    // Declared after `filteredErrors` because a panel holding an error is
    // forced visible — and forced open — regardless of the saved layout.
    const layout = useEditorLayout(
        'posts',
        supports,
        availablePanelIds,
        editorPreferences,
        filteredErrors,
    );

    function submit(e: FormEvent | null, statusOverride?: StatusOption['value']) {
        e?.preventDefault();
        // Inertia's FormDataConvertible covers primitives and arrays of
        // primitives. `featured_image` is the picker's local hydration
        // record, so we replace it with `featured_image_id` on submit.
        // The SEO sub-form's image pickers are reshaped the same way.
        const { featured_image: _featuredImage, seo, custom_fields, ...rest } = form;
        const effectiveStatus = statusOverride ?? form.status;
        // Save Draft over a Scheduled row overrides the payload but
        // the visible select was reading `form.status` — without
        // pulling `form` in sync, the picker snaps back to the old
        // value on next render AND the dirty pill relights because
        // baseline (now 'draft') no longer matches form ('scheduled').
        if (statusOverride && statusOverride !== form.status) {
            setForm((f) => ({ ...f, status: statusOverride }));
        }
        const rawPayload = {
            ...rest,
            status: effectiveStatus,
            featured_image_id: form.featured_image?.id ?? null,
            seo: serializeSeo(seo),
            custom_fields: mergeCustomFieldValues(customFields, custom_fields),
        };
        // Plugins can rewrite the submit payload — inject additional fields,
        // sanitize user input, prefix slug — through the generic
        // `keystone.admin.edit.form.beforeSubmit` filter or the
        // resource-scoped `.posts.edit.form.beforeSubmit` variant. Args:
        // `(payload, { resource, id })`; return the (possibly rewritten)
        // payload, or `false` to veto the submit entirely.
        //
        // Vetoing is silent by design — see docs/hooks.md. A subscriber
        // that returns `false` is responsible for its own user feedback
        // (toast, modal, inline error) because the shell can't know why
        // the plugin vetoed.
        const generic = applyFilters<typeof rawPayload | false>(
            'keystone.admin.edit.form.beforeSubmit',
            rawPayload,
            { resource: 'posts', id: post.id },
        );
        if (false === generic) return;
        const scoped = applyFilters<typeof rawPayload | false>(
            'keystone.admin.posts.edit.form.beforeSubmit',
            generic,
            { resource: 'posts', id: post.id },
        );
        if (false === scoped) return;
        fireEditFormSubmit('posts', post.id, scoped);
        // Snapshot the submitted form so `onSuccess` can flip the
        // baseline to the values the server now has. Reading `form`
        // directly inside the callback would risk clobbering
        // additional edits the user made while the request was in
        // flight — the snapshot only reflects what was actually sent.
        // Apply the same status override to the baseline so a Save
        // Draft over a Scheduled row doesn't leave the dirty flag on.
        const submittedForm = { ...form, status: effectiveStatus };
        router.put(update(post.id).url, scoped, {
            onSuccess: (page) => {
                // `slug`, `status`, and `published_at` are server-owned:
                // publishing with "Immediately" sends `published_at: null`
                // and gets a real timestamp back, a future date on
                // Published comes back as Scheduled, and a colliding slug
                // comes back adjusted. Rebasing from the fresh page props
                // — not the submitted snapshot — is what stops the panel
                // showing "Immediately" over a record that has a date, and
                // stops the next Update resubmitting the stale value.
                //
                // Read off `page`, not the component-scope `post`: this
                // closure captured the props from before the visit.
                const saved = (page.props as unknown as PageProps).post;
                const rebased = {
                    ...submittedForm,
                    slug: saved.slug,
                    status: saved.status,
                    published_at: saved.published_at,
                };

                setForm((current) => ({
                    ...current,
                    // Only adopt the server's value where the user hasn't
                    // typed something newer while the request was in
                    // flight — otherwise their edit would vanish, and
                    // silently, because the baseline matches it too.
                    slug: current.slug === submittedForm.slug ? saved.slug : current.slug,
                    status:
                        current.status === submittedForm.status ? saved.status : current.status,
                    published_at:
                        current.published_at === submittedForm.published_at
                            ? saved.published_at
                            : current.published_at,
                }));
                setBaseline(rebased);
                fireEditFormSuccess('posts', post.id, page);
            },
            onError: (formErrors) => {
                fireEditFormError('posts', post.id, formErrors);
                focusFirstInvalidField();
            },
        });
    }

    function handleDelete() {
        const gated = applyEditDelete('posts', post.id, post);
        if (false === gated) return;
        if (!keystoneConfirm(`Delete "${post.title}"? This cannot be undone.`)) return;
        router.delete(destroy(post.id).url, {
            onSuccess: () => fireEditDeleted('posts', post.id, post),
        });
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

    // Panel bodies keyed by registry id. `EditorPanelLayout` renders them
    // in the user's saved column and order; an entry that resolves to
    // `null` is skipped, which is how `supports` opts a post type out.
    const panelNodes: Record<string, ReactNode> = {
        publish: (
            <PublishPanel
                status={form.status}
                initialStatus={post.status}
                actualStatus={post.actual_status}
                statuses={statuses}
                hasEverBeenPublished={post.has_ever_been_published}
                author={post.author}
                showAuthor={has('author')}
                publishedAt={form.published_at}
                siteTimezone={siteTimezone}
                isDirty={isDirty}
                previewUrl={post.preview_url}
                statusError={filteredErrors.status}
                publishedAtError={filteredErrors.published_at}
                onStatusChange={(status) => setForm((f) => ({ ...f, status }))}
                onPublishedAtChange={(published_at) => setForm((f) => ({ ...f, published_at }))}
                onSaveDraft={() => submit(null, 'draft')}
                onDelete={handleDelete}
            />
        ),
        categories: has('categories') ? (
            <CategoriesPanel
                options={categories}
                selected={form.category_ids}
                onToggle={toggleCategory}
                createUrl={categoryStore().url}
            />
        ) : null,
        tags: has('tags') ? (
            <TagsPanel
                options={tags}
                selected={form.tag_ids}
                onToggle={toggleTag}
                createUrl={tagStore().url}
            />
        ) : null,
        featured_image: has('featured_image') ? (
            <FeaturedImagePanel
                value={form.featured_image}
                onChange={(next) => setForm((f) => ({ ...f, featured_image: next }))}
                context={`post-${post.id}`}
                resource="posts"
            />
        ) : null,
        excerpt: has('excerpt') ? (
            <ExcerptPanel
                value={form.excerpt}
                error={filteredErrors.excerpt}
                onChange={(excerpt) => setForm((f) => ({ ...f, excerpt }))}
            />
        ) : null,
        seo: has('seo') ? (
            <SeoMetaCard
                value={form.seo}
                onChange={(next) => setForm((f) => ({ ...f, seo: next }))}
                errors={filteredErrors}
                contextPrefix={`post-${post.id}`}
                resource="posts"
            />
        ) : null,
        custom_fields: has('custom_fields') ? (
            <CustomFieldsSection
                fields={customFields}
                values={form.custom_fields}
                errors={filteredErrors}
                onChange={(key, value) =>
                    setForm((f) => ({
                        ...f,
                        custom_fields: { ...f.custom_fields, [key]: value },
                    }))
                }
            />
        ) : null,
    };

    return (
        <>
            <Head title={`Edit ${post.title}`} />
            <AdminEditSlot
                slot="before-form"
                contentType="posts"
                record={post as unknown as Record<string, unknown>}
            />
            <form onSubmit={submit} className="flex flex-col gap-4">
                <PageHeader
                    breadcrumbs={['Blog Posts', post.title || 'Untitled']}
                    actions={
                        <>
                            <ScreenOptions
                                panels={layout.hideablePanels}
                                hidden={layout.hidden}
                                onToggle={layout.toggleHidden}
                                onReset={layout.reset}
                            />
                            <Link
                                href={index().url}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                            >
                                Back
                            </Link>
                        </>
                    }
                />

                {flash?.success && (
                    <div
                        /*
                         * `role="status"` — the save confirmation is the
                         * single most important state change on this screen
                         * and it was landing silently. The node is inserted
                         * fresh by the Inertia visit, which is what a polite
                         * live region announces.
                         */
                        role="status"
                        className="rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
                        {flash.success}
                    </div>
                )}

                <AdminEditSlot
                    slot="tabs"
                    contentType="posts"
                    record={post as unknown as Record<string, unknown>}
                />

                <EditorPanelLayout
                    layout={layout}
                    panels={panelNodes}
                    sidebarTop={
                        <AdminEditSlot
                            slot="sidebar-top"
                            contentType="posts"
                            record={post as unknown as Record<string, unknown>}
                        />
                    }
                    sidebarBottom={
                        <AdminEditSlot
                            slot="sidebar-bottom"
                            contentType="posts"
                            record={post as unknown as Record<string, unknown>}
                        />
                    }
                    editor={
                        <>
                            {/*
                             * A fully borderless title read as static text
                             * in early testing — users didn't realize it
                             * was editable. Keep a hairline underline at
                             * rest, plus a muted pencil affordance, so the
                             * click target is discoverable; deepen on
                             * hover, promote to primary on focus.
                             *
                             * `focus-within` targets the wrapper so the
                             * pencil visibility follows the input's focus
                             * state (the icon fades out once you're
                             * actively typing).
                             */}
                            <div className="group relative flex items-center rounded-t-md border-b border-base-300/60 hover:border-base-content/40 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40">
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, title: e.target.value }))
                                    }
                                    placeholder="Add title"
                                    aria-label="Title"
                                    aria-invalid={filteredErrors.title ? true : undefined}
                                    aria-describedby={
                                        filteredErrors.title ? 'post-title-error' : undefined
                                    }
                                    className="w-full border-0 bg-transparent px-0 py-2 pr-8 text-3xl font-semibold text-base-content outline-none placeholder:text-base-content/40"
                                />
                                <span
                                    aria-hidden
                                    className="pointer-events-none absolute right-1 flex items-center text-base-content/40 transition-opacity group-hover:text-base-content/70 group-focus-within:opacity-0"
                                >
                                    {Icon.edit}
                                </span>
                            </div>
                            {filteredErrors.title && (
                                <div
                                    id="post-title-error"
                                    role="alert"
                                    className="-mt-2 text-xs text-error"
                                >
                                    {filteredErrors.title}
                                </div>
                            )}
                            <SlugField
                                title={form.title}
                                slug={form.slug}
                                autoDeriveAllowed={
                                    form.status === 'draft' && !post.has_ever_been_published
                                }
                                previewUrl={slugPreview().url}
                                ignoreId={post.id}
                                permalinkTemplate={post.permalink_template}
                                error={filteredErrors.slug}
                                onSlugChange={(slug) => setForm((f) => ({ ...f, slug }))}
                            />

                            <AdminEditSlot
                                slot="before-editor"
                                contentType="posts"
                                record={post as unknown as Record<string, unknown>}
                            />

                            {has('editor') && (
                                <VisualEditor
                                    resource="posts"
                                    id={post.id}
                                    initialTitle={post.title}
                                    initialSlug={post.slug}
                                    initialStatus={post.status}
                                    supports={{ title: false, document: false }}
                                />
                            )}

                            <AdminEditSlot
                                slot="after-editor"
                                contentType="posts"
                                record={post as unknown as Record<string, unknown>}
                            />
                        </>
                    }
                />
            </form>
            <AdminEditSlot
                slot="after-form"
                contentType="posts"
                record={post as unknown as Record<string, unknown>}
            />
        </>
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

Edit.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
