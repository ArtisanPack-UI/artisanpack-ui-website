import { useState, type FormEvent, type ReactNode } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, DataTable, Icon, PageHeader } from '@/components/admin/keystone';
import { formatRelativeTime } from '@/lib/admin/shared';
import { destroy, edit, store } from '@/routes/admin/posts/tags';

interface TagRow {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    posts_count: number;
    updated_at: string;
}

interface PageProps {
    tags: TagRow[];
    errors: Record<string, string>;
    flash?: { success?: string; error?: string };
    [key: string]: unknown;
}

export default function TagsIndex() {
    const { tags, errors, flash } = usePage<PageProps>().props;
    const [form, setForm] = useState({
        name: '',
        slug: '',
        description: '',
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        router.post(store().url, form, {
            preserveScroll: true,
            onSuccess: () => setForm({ name: '', slug: '', description: '' }),
        });
    }

    function handleDelete(tag: TagRow) {
        if (!confirm(`Delete "${tag.name}"? This cannot be undone.`)) return;
        router.delete(destroy(tag.id).url, { preserveScroll: true });
    }

    return (
        <>
            <Head title="Tags" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Tags"
                    description="Lightweight, non-hierarchical labels for your blog posts."
                    breadcrumbs={['Blog Posts', 'Tags']}
                />

                {flash?.success && (
                    <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
                        {flash.error}
                    </div>
                )}

                <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <Card>
                        <form onSubmit={submit} className="flex flex-col gap-5">
                            <h2 className="text-sm font-semibold text-base-content/85">
                                Add new tag
                            </h2>
                            <Field
                                label="Name"
                                error={errors.name}
                                input={
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) =>
                                            setForm({ ...form, name: e.target.value })
                                        }
                                        className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary"
                                    />
                                }
                            />
                            <Field
                                label="Slug"
                                hint="Leave blank to auto-generate from the name."
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
                            <Field
                                label="Description"
                                error={errors.description}
                                input={
                                    <textarea
                                        rows={3}
                                        value={form.description}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                description: e.target.value,
                                            })
                                        }
                                        className="w-full rounded-md border border-base-300/60 bg-base-100 px-3 py-2 text-sm outline-none focus:border-primary"
                                    />
                                }
                            />
                            <div>
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary-hover"
                                >
                                    {Icon.plus}
                                    Add tag
                                </button>
                            </div>
                        </form>
                    </Card>

                    <Card padded={false}>
                        <DataTable<TagRow>
                            resource="posts.tags"
                            columns={[
                                {
                                    key: 'name',
                                    label: 'Name',
                                    render: (r) => (
                                        <div>
                                            <Link
                                                href={edit(r.id).url}
                                                className="font-semibold text-base-content hover:text-primary"
                                            >
                                                {r.name}
                                            </Link>
                                            <div className="font-mono text-[11px] text-base-content/55">
                                                /{r.slug}
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'description',
                                    label: 'Description',
                                    muted: true,
                                    render: (r) => r.description ?? '—',
                                },
                                {
                                    key: 'posts_count',
                                    label: 'Posts',
                                    muted: true,
                                },
                                {
                                    key: 'updated_at',
                                    label: 'Updated',
                                    muted: true,
                                    render: (r) => formatRelativeTime(r.updated_at),
                                },
                                {
                                    key: 'actions',
                                    label: '',
                                    align: 'right',
                                    render: (r) => (
                                        <div className="flex items-center justify-end gap-1">
                                            <Link
                                                href={edit(r.id).url}
                                                title="Edit"
                                                aria-label={`Edit ${r.name}`}
                                                className="grid h-7 w-7 place-items-center rounded-md text-base-content/55 hover:bg-base-200 hover:text-base-content"
                                            >
                                                {Icon.edit}
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(r)}
                                                title="Delete"
                                                aria-label={`Delete ${r.name}`}
                                                className="grid h-7 w-7 place-items-center rounded-md text-base-content/55 hover:bg-error/10 hover:text-error"
                                            >
                                                {Icon.trash}
                                            </button>
                                        </div>
                                    ),
                                },
                            ]}
                            rows={tags}
                        />
                    </Card>
                </div>
            </div>
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

TagsIndex.layout = (page: ReactNode) => (
    <KeystoneAdminLayout>{page}</KeystoneAdminLayout>
);
