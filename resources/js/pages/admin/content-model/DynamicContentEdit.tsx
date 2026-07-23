import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { PageHeader } from '@/components/admin/keystone';
import CollapsibleCard from '@/components/admin/CollapsibleCard';
import VisualEditor from '@/components/admin/VisualEditor';
import FeaturedImagePicker, { type FeaturedImageRecord } from '@/components/admin/FeaturedImagePicker';
import { update as contentUpdate } from '@/routes/admin/content';
import { store as taxonomyTermStore } from '@/routes/admin/content-model/taxonomies/terms';
import { FlashCards, TextField } from './ContentTypes';
import type { KeystoneSharedProps } from '@/types/keystone';

interface ContentTypeSummary {
    slug: string;
    name: string;
    supports: string[];
    has_column: {
        status: boolean;
        published_at: boolean;
        excerpt: boolean;
        content: boolean;
        featured_image_id: boolean;
        author_id: boolean;
    };
}
interface FieldDef { name: string; key: string; type: string; required: boolean; default_value: string }
interface TaxonomyRef { slug: string; name: string; hierarchical: boolean }
interface TermRef { id: number; name: string }
interface AuthorOption { id: number; label: string }
interface StatusOption { value: string; label: string }

interface PageProps extends KeystoneSharedProps {
    contentType: ContentTypeSummary;
    fields: FieldDef[];
    taxonomies: TaxonomyRef[];
    terms: Record<string, TermRef[]>;
    assignedTermIds: number[];
    featuredImage: FeaturedImageRecord | null;
    authors: AuthorOption[];
    statuses: StatusOption[];
    record: Record<string, unknown>;
    flash?: { success?: string; warning?: string; error?: string };
    errors?: Record<string, string>;
    [key: string]: unknown;
}

export default function DynamicContentEdit() {
    const {
        contentType,
        fields,
        taxonomies,
        terms,
        assignedTermIds,
        featuredImage,
        authors,
        statuses,
        record,
        flash,
        errors,
    } = usePage<PageProps>().props;

    const supports = contentType.supports ?? [];
    // Column presence beats supports for rendering — an older table can
    // predate the additive migration and be missing columns the type
    // declares support for. The server silently drops writes to missing
    // columns; rendering them would let editors submit values that are
    // never persisted.
    const hasColumn = contentType.has_column;
    const showContent = supports.includes('content') && hasColumn.content;
    const showExcerpt = supports.includes('excerpt') && hasColumn.excerpt;
    const showFeaturedImage = supports.includes('featured_image') && hasColumn.featured_image_id;
    const showAuthor = supports.includes('author') && hasColumn.author_id;
    const showPublishing = hasColumn.status;
    const showPublishedAt = hasColumn.published_at;

    const initial = useMemo(() => {
        const values: Record<string, string> = {};
        for (const field of fields) {
            const existing = record[field.key];
            values[field.key] = existing == null ? field.default_value : String(existing);
        }
        return values;
    }, [fields, record]);

    const [termsByTax, setTermsByTax] = useState<Record<string, TermRef[]>>(terms);
    const [newTermInput, setNewTermInput] = useState<Record<string, string>>({});
    // Local mirror of the picker's current selection so the thumbnail
    // updates the instant the user picks. Server-round-trip re-syncs
    // via the `featuredImage` prop when the page reloads after save.
    const [featuredImageLocal, setFeaturedImageLocal] = useState<FeaturedImageRecord | null>(featuredImage);

    const form = useForm<{
        title: string;
        excerpt: string;
        status: string;
        published_at: string;
        author_id: number | null;
        featured_image_id: number | null;
        values: Record<string, string>;
        term_ids: number[];
    }>({
        title: (record.title as string | null) ?? '',
        excerpt: (record.excerpt as string | null) ?? '',
        status: (record.status as string | null) ?? 'draft',
        published_at: (record.published_at as string | null) ?? '',
        author_id: (record.author_id as number | null) ?? null,
        featured_image_id: (record.featured_image_id as number | null) ?? null,
        values: initial,
        term_ids: assignedTermIds ?? [],
    });

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        form.put(contentUpdate([contentType.slug, record.id as number]).url, { preserveScroll: true });
    }

    function toggleTerm(termId: number) {
        const set = new Set(form.data.term_ids);
        if (set.has(termId)) {
            set.delete(termId);
        } else {
            set.add(termId);
        }
        form.setData('term_ids', Array.from(set));
    }

    async function addTerm(taxonomySlug: string) {
        const name = (newTermInput[taxonomySlug] ?? '').trim();
        if (!name) return;

        const res = await fetch(taxonomyTermStore(taxonomySlug).url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? ''),
            },
            body: JSON.stringify({ name }),
        });
        if (!res.ok) return;
        const term = (await res.json()) as TermRef;
        setTermsByTax((prev) => ({
            ...prev,
            [taxonomySlug]: [...(prev[taxonomySlug] ?? []), term],
        }));
        form.setData('term_ids', [...form.data.term_ids, term.id]);
        setNewTermInput((prev) => ({ ...prev, [taxonomySlug]: '' }));
    }

    return (
        <>
            <Head title={form.data.title || `Edit ${contentType.name}`} />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title={form.data.title || contentType.name}
                    description={`Record #${record.id}`}
                    breadcrumbs={[contentType.name, 'Edit']}
                    actions={
                        <button
                            type="submit"
                            form="dynamic-content-form"
                            disabled={form.processing}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90 disabled:opacity-50"
                        >
                            {form.processing ? 'Saving…' : 'Save changes'}
                        </button>
                    }
                />
                <FlashCards flash={flash} errors={errors} />

                <form id="dynamic-content-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <CollapsibleCard title="CONTENT" defaultOpen>
                        <div className="flex flex-col gap-4">
                            <TextField label="Title" value={form.data.title} onChange={(v) => form.setData('title', v)} error={form.errors.title} />
                            {showExcerpt ? (
                                <div>
                                    <label className="text-xs font-semibold text-base-content/60">Excerpt</label>
                                    <textarea
                                        value={form.data.excerpt}
                                        onChange={(e) => form.setData('excerpt', e.target.value)}
                                        rows={3}
                                        className="mt-1 block w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-sm"
                                    />
                                    <p className="mt-1 text-[11px] text-base-content/50">Short summary shown in listings.</p>
                                    {form.errors.excerpt ? <div className="mt-1 text-xs text-error">{form.errors.excerpt}</div> : null}
                                </div>
                            ) : null}
                        </div>
                    </CollapsibleCard>

                    {showPublishing ? (
                    <CollapsibleCard
                        title="Publishing"
                        summary={`${statusSummary(form.data.status, statuses)} · ${authorLabel(form.data.author_id, authors)}`}
                        defaultOpen
                    >
                        <div className="grid gap-5 md:grid-cols-2">
                            <Field
                                label="Status"
                                error={form.errors.status}
                                input={
                                    <select
                                        value={form.data.status}
                                        onChange={(e) => form.setData('status', e.target.value)}
                                        className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary"
                                    >
                                        {statuses.map((s) => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                }
                            />
                            {showAuthor ? (
                                <Field
                                    label="Author"
                                    error={form.errors.author_id}
                                    input={
                                        <select
                                            value={form.data.author_id ?? ''}
                                            onChange={(e) => form.setData('author_id', e.target.value === '' ? null : Number(e.target.value))}
                                            className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary"
                                        >
                                            <option value="">— None —</option>
                                            {authors.map((a) => (
                                                <option key={a.id} value={a.id}>{a.label}</option>
                                            ))}
                                        </select>
                                    }
                                />
                            ) : null}
                            {showPublishedAt ? (
                            <Field
                                label="Published at"
                                hint="ISO-8601. Leave blank to auto-fill on publish."
                                error={form.errors.published_at}
                                input={
                                    <input
                                        type="text"
                                        value={form.data.published_at ?? ''}
                                        onChange={(e) => form.setData('published_at', e.target.value)}
                                        className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary"
                                    />
                                }
                            />
                            ) : null}
                        </div>
                    </CollapsibleCard>
                    ) : null}

                    {showFeaturedImage ? (
                        <CollapsibleCard title="FEATURED IMAGE" defaultOpen={featuredImage !== null}>
                            <FeaturedImagePicker
                                value={featuredImageLocal}
                                onChange={(media) => {
                                    setFeaturedImageLocal(media);
                                    form.setData('featured_image_id', media?.id ?? null);
                                }}
                            />
                            {form.errors.featured_image_id ? (
                                <div className="mt-1 text-xs text-error">{form.errors.featured_image_id}</div>
                            ) : null}
                        </CollapsibleCard>
                    ) : null}

                    {taxonomies.length > 0 ? (
                        <CollapsibleCard title="TAXONOMIES" summary={taxonomies.map((t) => t.name).join(' · ')} defaultOpen>
                            <div className="flex flex-col gap-4">
                                {taxonomies.map((tax) => {
                                    const taxTerms = termsByTax[tax.slug] ?? [];
                                    return (
                                        <div key={tax.slug}>
                                            <div className="text-xs font-semibold text-base-content/60">{tax.name}</div>
                                            <div className="mt-1 flex flex-wrap gap-2">
                                                {taxTerms.map((term) => {
                                                    const active = form.data.term_ids.includes(term.id);
                                                    return (
                                                        <button
                                                            key={term.id}
                                                            type="button"
                                                            onClick={() => toggleTerm(term.id)}
                                                            aria-pressed={active}
                                                            className={
                                                                'cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold ' +
                                                                (active
                                                                    ? 'border-primary bg-primary/10 text-primary'
                                                                    : 'border-base-300 text-base-content/70 hover:bg-base-200')
                                                            }
                                                        >
                                                            {term.name}
                                                        </button>
                                                    );
                                                })}
                                                {taxTerms.length === 0 ? (
                                                    <span className="text-[11px] text-base-content/50">No terms yet.</span>
                                                ) : null}
                                            </div>
                                            {/* Div-not-form: nesting a real <form> inside the outer save form
                                                triggers a hydration warning + Enter still saves the outer form
                                                first. Enter here calls addTerm() and stops propagation. */}
                                            <div className="mt-2 flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={newTermInput[tax.slug] ?? ''}
                                                    onChange={(e) => setNewTermInput((prev) => ({ ...prev, [tax.slug]: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            void addTerm(tax.slug);
                                                        }
                                                    }}
                                                    placeholder="New term…"
                                                    className="h-9 w-full max-w-xs rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => void addTerm(tax.slug)}
                                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-base-300 px-3 py-1.5 text-xs font-semibold text-base-content/75 hover:bg-base-200"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CollapsibleCard>
                    ) : null}

                    {fields.length > 0 ? (
                        <CollapsibleCard title="CUSTOM FIELDS" summary={`${fields.length} field${fields.length === 1 ? '' : 's'}`} defaultOpen>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {fields.map((field) => (
                                    <TextField
                                        key={field.key}
                                        label={field.name + (field.required ? ' *' : '')}
                                        value={form.data.values[field.key] ?? ''}
                                        onChange={(v) => form.setData('values', { ...form.data.values, [field.key]: v })}
                                        error={form.errors[`values.${field.key}` as keyof typeof form.errors] as string | undefined}
                                    />
                                ))}
                            </div>
                        </CollapsibleCard>
                    ) : null}

                    <CollapsibleCard title="ATTRIBUTES" summary={`slug: ${contentType.slug}`}>
                        <div className="text-xs text-base-content/60">
                            <div>Content type: <span className="font-mono">{contentType.slug}</span></div>
                            {supports.length > 0 ? (
                                <div className="mt-1">Supports: {supports.join(', ')}</div>
                            ) : null}
                        </div>
                    </CollapsibleCard>

                    {showContent ? (
                        <VisualEditor
                            resource={contentType.slug}
                            id={record.id as number}
                            initialTitle={form.data.title}
                            supports={{ title: false, document: false, excerpt: showExcerpt, featuredImage: false }}
                        />
                    ) : null}
                </form>
            </div>
        </>
    );
}

function statusSummary(value: string, options: StatusOption[]): string {
    return options.find((o) => o.value === value)?.label ?? value;
}

function authorLabel(id: number | null, authors: AuthorOption[]): string {
    if (id === null) return '—';
    return authors.find((a) => a.id === id)?.label ?? '—';
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
            {hint && !error ? <span className="text-xs text-base-content/55">{hint}</span> : null}
            {error ? <span className="text-xs text-error">{error}</span> : null}
        </label>
    );
}

DynamicContentEdit.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
