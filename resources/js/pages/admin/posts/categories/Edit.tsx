import { useState, type FormEvent, type ReactNode } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, Icon, PageHeader } from '@/components/admin/keystone';
import { destroy, index, update } from '@/routes/admin/posts/categories';

interface ParentOption {
    value: number;
    label: string;
}

interface AdminCategory {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    parent_id: number | null;
    order: number;
}

interface PageProps {
    category: AdminCategory;
    parentOptions: ParentOption[];
    errors: Record<string, string>;
    flash?: { success?: string; error?: string };
    [key: string]: unknown;
}

export default function CategoriesEdit() {
    const { category, parentOptions, errors, flash } =
        usePage<PageProps>().props;
    const [form, setForm] = useState({
        name: category.name,
        slug: category.slug,
        description: category.description ?? '',
        parent_id: category.parent_id,
        order: category.order,
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        router.put(update(category.id).url, form);
    }

    function handleDelete() {
        if (!confirm(`Delete "${category.name}"? This cannot be undone.`)) return;
        router.delete(destroy(category.id).url);
    }

    return (
        <>
            <Head title={`Edit ${category.name}`} />
            <form onSubmit={submit} className="flex flex-col gap-7">
                <PageHeader
                    title={category.name}
                    description={`/${category.slug}`}
                    breadcrumbs={['Blog Posts', 'Categories', category.name]}
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

                <Card>
                    <div className="grid gap-5 md:grid-cols-2">
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
                            label="Parent category"
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
                                    <option value="">— None —</option>
                                    {parentOptions.map((p) => (
                                        <option key={p.value} value={p.value}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>
                            }
                        />
                        <Field
                            label="Order"
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
                        <div className="md:col-span-2">
                            <Field
                                label="Description"
                                error={errors.description}
                                input={
                                    <textarea
                                        rows={4}
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
                        </div>
                    </div>
                </Card>
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

CategoriesEdit.layout = (page: ReactNode) => (
    <KeystoneAdminLayout>{page}</KeystoneAdminLayout>
);
