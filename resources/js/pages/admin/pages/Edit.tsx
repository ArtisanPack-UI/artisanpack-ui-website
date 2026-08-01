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
import { keystoneConfirm } from '@/lib/admin/confirm';
import { focusFirstInvalidField } from '@/lib/admin/focusFirstInvalidField';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Icon, PageHeader } from '@/components/admin/keystone';
import { type ActualStatus } from '@/components/admin/editor/panels/PublishPanel';
import { type FeaturedImageRecord } from '@/components/admin/FeaturedImagePicker';
import SeoMetaCard, { type SeoMetaForm } from '@/components/admin/SeoMetaCard';
import VisualEditor from '@/components/admin/VisualEditor';
import CustomFieldsSection from '@/components/admin/custom-fields/CustomFieldsSection';
import { mergeCustomFieldValues } from '@/components/admin/custom-fields/mergeValues';
import type { CustomFieldRecord } from '@/components/admin/custom-fields/types';
import AdminEditSlot from '@/components/admin/panels/AdminEditSlot';
import SlugField from '@/components/admin/SlugField';
import PublishPanel, { type StatusOption } from '@/components/admin/editor/panels/PublishPanel';
import FeaturedImagePanel from '@/components/admin/editor/panels/FeaturedImagePanel';
import ExcerptPanel from '@/components/admin/editor/panels/ExcerptPanel';
import AttributesPanel, {
    type ParentOption,
} from '@/components/admin/editor/panels/AttributesPanel';
import ScreenOptions from '@/components/admin/editor/ScreenOptions';
import EditorPanelLayout from '@/components/admin/editor/EditorPanelLayout';
import { useEditorLayout } from '@/components/admin/editor/useEditorLayout';
import type { EditorPreferencesPayload } from '@/lib/admin/editorPreferencesApi';
import { destroy, index, slugPreview, update } from '@/routes/admin/pages';

interface AdminPage {
    id: number;
    title: string;
    slug: string;
    permalink_template: string;
    status: StatusOption['value'];
    actual_status: ActualStatus;
    has_ever_been_published: boolean;
    excerpt: string | null;
    template: string | null;
    parent_id: number | null;
    order: number;
    author: string | null;
    published_at: string | null;
    updated_at: string | null;
    featured_image: FeaturedImageRecord | null;
    seo: SeoMetaForm;
    /** Signed, time-limited preview URL. Null when the record type isn't previewable. */
    preview_url: string | null;
}

interface PageProps {
    page: AdminPage;
    statuses: StatusOption[];
    siteTimezone: string;
    parentOptions: ParentOption[];
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
        page,
        statuses,
        siteTimezone,
        parentOptions,
        customFields,
        supports,
        editorPreferences,
        errors,
        flash,
    } = usePage<PageProps>().props;
    const has = (flag: string): boolean => flag === 'title' || supports.includes(flag);
    const initialForm = useMemo(
        () => ({
            title: page.title,
            slug: page.slug,
            status: page.status,
            published_at: page.published_at,
            excerpt: page.excerpt ?? '',
            template: page.template ?? '',
            parent_id: page.parent_id,
            order: page.order,
            featured_image: page.featured_image,
            seo: page.seo,
            custom_fields: {} as Record<string, unknown>,
        }),
        [page],
    );
    const [form, setForm] = useState(initialForm);
    // See posts/Edit.tsx for the rationale on the separate baseline
    // state — Inertia PUT visits preserve local React state so isDirty
    // needs an explicit reset on successful save.
    const [baseline, setBaseline] = useState(initialForm);

    useEditFormState('pages', page.id, form);
    const isDirty = useMemo(
        () => JSON.stringify(form) !== JSON.stringify(baseline),
        [form, baseline],
    );
    useEditFormDirty('pages', page.id, isDirty);
    useEditLeaveConfirm('pages', page.id, isDirty);
    const filteredErrors = useEditFormValidate('pages', page.id, form, errors);
    // See posts/Edit.tsx — `supports` gates what the content type offers,
    // the saved layout gates what this user sees of it and where, and an
    // error inside a hidden or collapsed panel forces it back on screen.
    // `AttributesPanel` renders nothing without one of its two flags, so
    // it is filtered here rather than left as an undraggable empty slot.
    const availablePanelIds = useMemo(
        () =>
            [
                'publish',
                has('page_attributes') || has('templates') ? 'attributes' : null,
                'featured_image',
                'excerpt',
                'seo',
                customFields.length > 0 ? 'custom_fields' : null,
            ].filter((id): id is string => null !== id),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `has` closes over `supports`, which is the real dependency.
        [supports, customFields.length],
    );
    const layout = useEditorLayout(
        'pages',
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
        // See posts/Edit.tsx — a Save Draft override needs to pull
        // form.status in sync or the select snaps back and the dirty
        // pill relights on the next render.
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
        // See posts/Edit.tsx and docs/hooks.md for the filter contract:
        // returning `false` vetoes the submit silently — the vetoing
        // plugin is responsible for its own user feedback. Otherwise the
        // returned payload replaces the built-in one.
        const generic = applyFilters<typeof rawPayload | false>(
            'keystone.admin.edit.form.beforeSubmit',
            rawPayload,
            { resource: 'pages', id: page.id },
        );
        if (false === generic) return;
        const scoped = applyFilters<typeof rawPayload | false>(
            'keystone.admin.pages.edit.form.beforeSubmit',
            generic,
            { resource: 'pages', id: page.id },
        );
        if (false === scoped) return;
        fireEditFormSubmit('pages', page.id, scoped);
        // Match the submitted status onto the baseline so a Save
        // Draft over a Scheduled row doesn't leave the dirty flag on.
        const submittedForm = { ...form, status: effectiveStatus };
        router.put(update(page.id).url, scoped, {
            onSuccess: (result) => {
                // See posts/Edit.tsx: `slug`, `status`, and `published_at`
                // are server-owned, so both the form and the dirty
                // baseline have to be rebased from the fresh page props
                // rather than the snapshot we submitted.
                const saved = (result.props as unknown as PageProps).page;
                const rebased = {
                    ...submittedForm,
                    slug: saved.slug,
                    status: saved.status,
                    published_at: saved.published_at,
                };

                setForm((current) => ({
                    ...current,
                    slug: current.slug === submittedForm.slug ? saved.slug : current.slug,
                    status:
                        current.status === submittedForm.status ? saved.status : current.status,
                    published_at:
                        current.published_at === submittedForm.published_at
                            ? saved.published_at
                            : current.published_at,
                }));
                setBaseline(rebased);
                fireEditFormSuccess('pages', page.id, result);
            },
            onError: (formErrors) => {
                fireEditFormError('pages', page.id, formErrors);
                focusFirstInvalidField();
            },
        });
    }

    function handleDelete() {
        const gated = applyEditDelete('pages', page.id, page);
        if (false === gated) return;
        if (!keystoneConfirm(`Delete "${page.title}"? This cannot be undone.`)) return;
        router.delete(destroy(page.id).url, {
            onSuccess: () => fireEditDeleted('pages', page.id, page),
        });
    }

    // Panel bodies keyed by registry id — see posts/Edit.tsx.
    const panelNodes: Record<string, ReactNode> = {
        publish: (
            <PublishPanel
                status={form.status}
                initialStatus={page.status}
                actualStatus={page.actual_status}
                statuses={statuses}
                hasEverBeenPublished={page.has_ever_been_published}
                author={page.author}
                showAuthor={has('author')}
                publishedAt={form.published_at}
                siteTimezone={siteTimezone}
                isDirty={isDirty}
                previewUrl={page.preview_url}
                statusError={filteredErrors.status}
                publishedAtError={filteredErrors.published_at}
                onStatusChange={(status) => setForm((f) => ({ ...f, status }))}
                onPublishedAtChange={(published_at) => setForm((f) => ({ ...f, published_at }))}
                onSaveDraft={() => submit(null, 'draft')}
                onDelete={handleDelete}
            />
        ),
        attributes: (
            <AttributesPanel
                parentId={form.parent_id}
                template={form.template}
                order={form.order}
                parentOptions={parentOptions}
                showParentAndOrder={has('page_attributes')}
                showTemplate={has('templates')}
                parentError={filteredErrors.parent_id}
                templateError={filteredErrors.template}
                orderError={filteredErrors.order}
                onParentChange={(parent_id) => setForm((f) => ({ ...f, parent_id }))}
                onTemplateChange={(template) => setForm((f) => ({ ...f, template }))}
                onOrderChange={(order) => setForm((f) => ({ ...f, order }))}
            />
        ),
        featured_image: has('featured_image') ? (
            <FeaturedImagePanel
                value={form.featured_image}
                onChange={(next) => setForm((f) => ({ ...f, featured_image: next }))}
                context={`page-${page.id}`}
                resource="pages"
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
                contextPrefix={`page-${page.id}`}
                resource="pages"
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
            <Head title={`Edit ${page.title}`} />
            <AdminEditSlot
                slot="before-form"
                contentType="pages"
                record={page as unknown as Record<string, unknown>}
            />
            <form onSubmit={submit} className="flex flex-col gap-4">
                <PageHeader
                    breadcrumbs={['Pages', page.title || 'Untitled']}
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
                    contentType="pages"
                    record={page as unknown as Record<string, unknown>}
                />

                <EditorPanelLayout
                    layout={layout}
                    panels={panelNodes}
                    sidebarTop={
                        <AdminEditSlot
                            slot="sidebar-top"
                            contentType="pages"
                            record={page as unknown as Record<string, unknown>}
                        />
                    }
                    sidebarBottom={
                        <AdminEditSlot
                            slot="sidebar-bottom"
                            contentType="pages"
                            record={page as unknown as Record<string, unknown>}
                        />
                    }
                    editor={
                        <>
                            {/* See posts/Edit.tsx for the underline + pencil rationale. */}
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
                                        filteredErrors.title ? 'page-title-error' : undefined
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
                                    id="page-title-error"
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
                                    form.status === 'draft' && !page.has_ever_been_published
                                }
                                previewUrl={slugPreview().url}
                                ignoreId={page.id}
                                permalinkTemplate={page.permalink_template}
                                error={filteredErrors.slug}
                                onSlugChange={(slug) => setForm((f) => ({ ...f, slug }))}
                            />

                            <AdminEditSlot
                                slot="before-editor"
                                contentType="pages"
                                record={page as unknown as Record<string, unknown>}
                            />

                            {has('editor') && (
                                <VisualEditor
                                    resource="pages"
                                    id={page.id}
                                    initialTitle={page.title}
                                    initialSlug={page.slug}
                                    initialStatus={page.status}
                                    supports={{ title: false, document: false }}
                                />
                            )}

                            <AdminEditSlot
                                slot="after-editor"
                                contentType="pages"
                                record={page as unknown as Record<string, unknown>}
                            />
                        </>
                    }
                />
            </form>
            <AdminEditSlot
                slot="after-form"
                contentType="pages"
                record={page as unknown as Record<string, unknown>}
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
