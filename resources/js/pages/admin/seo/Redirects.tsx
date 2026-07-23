import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Icon, PageHeader } from '@/components/admin/keystone';
import { destroy, store, update } from '@/routes/admin/seo/redirects';

type StatusCode = 301 | 302 | 307 | 308;
type MatchType = 'exact' | 'regex' | 'wildcard';

interface Redirect {
    id: number;
    from_path: string;
    to_path: string;
    status_code: StatusCode;
    match_type: MatchType;
    is_active: boolean;
    hits: number;
    last_hit_at: string | null;
    notes: string | null;
    updated_at: string | null;
}

interface PageProps {
    redirects: Redirect[];
    errors: Record<string, string>;
    flash?: { success?: string; error?: string };
    [key: string]: unknown;
}

const STATUS_OPTIONS: Array<{ value: StatusCode; label: string }> = [
    { value: 301, label: '301 — Permanent' },
    { value: 302, label: '302 — Temporary' },
    { value: 307, label: '307 — Temporary (method-preserving)' },
    { value: 308, label: '308 — Permanent (method-preserving)' },
];

const MATCH_OPTIONS: Array<{ value: MatchType; label: string; hint: string }> = [
    {
        value: 'exact',
        label: 'Exact',
        hint: 'Match this URL only. Most common choice.',
    },
    {
        value: 'wildcard',
        label: 'Wildcard',
        hint: 'Use * to match any segment, e.g. /old/* → /new/*.',
    },
    {
        value: 'regex',
        label: 'Regex',
        hint: 'Full PCRE. Powerful but easy to misfire.',
    },
];

interface FormState {
    id: number | null;
    from_path: string;
    to_path: string;
    status_code: StatusCode;
    match_type: MatchType;
    is_active: boolean;
    notes: string;
}

const EMPTY_FORM: FormState = {
    id: null,
    from_path: '',
    to_path: '',
    status_code: 301,
    match_type: 'exact',
    is_active: true,
    notes: '',
};

/**
 * Redirects admin. Table view + inline editor that POSTs to the
 * SeoRedirectController which then clears the SEO package's redirect
 * cache so changes take effect immediately.
 */
export default function Redirects() {
    const { redirects, errors, flash } = usePage<PageProps>().props;
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const isEditing = form.id !== null;

    const filteredErrors = useMemo(
        () =>
            Object.fromEntries(
                Object.entries(errors).filter(([key]) =>
                    [
                        'from_path',
                        'to_path',
                        'status_code',
                        'match_type',
                        'is_active',
                        'notes',
                    ].includes(key),
                ),
            ),
        [errors],
    );

    function submit(e: FormEvent) {
        e.preventDefault();
        const payload = {
            from_path: form.from_path.trim(),
            to_path: form.to_path.trim(),
            status_code: form.status_code,
            match_type: form.match_type,
            is_active: form.is_active,
            notes: form.notes.trim() === '' ? null : form.notes.trim(),
        };

        if (isEditing && form.id !== null) {
            router.put(update(form.id).url, payload, {
                onSuccess: () => setForm(EMPTY_FORM),
            });
            return;
        }

        router.post(store().url, payload, {
            onSuccess: () => setForm(EMPTY_FORM),
        });
    }

    function startEdit(redirect: Redirect) {
        setForm({
            id: redirect.id,
            from_path: redirect.from_path,
            to_path: redirect.to_path,
            status_code: redirect.status_code,
            match_type: redirect.match_type,
            is_active: redirect.is_active,
            notes: redirect.notes ?? '',
        });
    }

    function cancelEdit() {
        setForm(EMPTY_FORM);
    }

    function handleDelete(redirect: Redirect) {
        if (
            !confirm(`Delete the redirect for "${redirect.from_path}"?`)
        ) {
            return;
        }
        router.delete(destroy(redirect.id).url);
    }

    return (
        <>
            <Head title="SEO redirects" />
            <div className="flex flex-col gap-4">
                <PageHeader
                    title="Redirects"
                    description="301/302/307/308 rules applied by the SEO middleware on every public request."
                    breadcrumbs={['SEO', 'Redirects']}
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

                <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,420px)]">
                    <RedirectsTable
                        redirects={redirects}
                        activeId={form.id}
                        onEdit={startEdit}
                        onDelete={handleDelete}
                    />

                    <form
                        onSubmit={submit}
                        className="flex flex-col gap-4 rounded-xl border border-base-300/60 bg-base-100 p-5"
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-semibold">
                                {isEditing ? 'Edit redirect' : 'New redirect'}
                            </h2>
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="text-xs font-semibold text-base-content/65 hover:text-base-content"
                                >
                                    Cancel edit
                                </button>
                            )}
                        </div>

                        <Field
                            label="From path"
                            hint="e.g. /old-page  ·  prefix with / for site-relative."
                            error={filteredErrors.from_path}
                            input={
                                <input
                                    type="text"
                                    value={form.from_path}
                                    onChange={(e) =>
                                        setForm({ ...form, from_path: e.target.value })
                                    }
                                    placeholder="/about-us"
                                    className={inputClass}
                                />
                            }
                        />
                        <Field
                            label="To path"
                            hint="Target — relative path or full URL."
                            error={filteredErrors.to_path}
                            input={
                                <input
                                    type="text"
                                    value={form.to_path}
                                    onChange={(e) =>
                                        setForm({ ...form, to_path: e.target.value })
                                    }
                                    placeholder="/about"
                                    className={inputClass}
                                />
                            }
                        />
                        <Field
                            label="Status code"
                            error={filteredErrors.status_code}
                            input={
                                <select
                                    value={form.status_code}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            status_code: Number(
                                                e.target.value,
                                            ) as StatusCode,
                                        })
                                    }
                                    className={inputClass}
                                >
                                    {STATUS_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            }
                        />
                        <Field
                            label="Match type"
                            error={filteredErrors.match_type}
                            hint={
                                MATCH_OPTIONS.find(
                                    (opt) => opt.value === form.match_type,
                                )?.hint
                            }
                            input={
                                <select
                                    value={form.match_type}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            match_type: e.target.value as MatchType,
                                        })
                                    }
                                    className={inputClass}
                                >
                                    {MATCH_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            }
                        />
                        <Field
                            label="Notes"
                            hint="Optional context shown only in this admin."
                            error={filteredErrors.notes}
                            input={
                                <textarea
                                    rows={2}
                                    value={form.notes}
                                    onChange={(e) =>
                                        setForm({ ...form, notes: e.target.value })
                                    }
                                    className={`${inputClass} h-auto py-2`}
                                />
                            }
                        />
                        <label className="flex items-start gap-3 text-sm">
                            <input
                                type="checkbox"
                                checked={form.is_active}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        is_active: e.target.checked,
                                    })
                                }
                                className="mt-1 h-4 w-4 rounded border-base-300 text-primary focus:ring-primary"
                            />
                            <span className="flex flex-col">
                                <span className="font-medium text-base-content/85">
                                    Active
                                </span>
                                <span className="text-xs text-base-content/55">
                                    Inactive redirects stay in the table but are
                                    skipped by the middleware.
                                </span>
                            </span>
                        </label>

                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                                type="submit"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90"
                            >
                                {Icon.edit}
                                {isEditing ? 'Save changes' : 'Create redirect'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

function RedirectsTable({
    redirects,
    activeId,
    onEdit,
    onDelete,
}: {
    redirects: Redirect[];
    activeId: number | null;
    onEdit: (redirect: Redirect) => void;
    onDelete: (redirect: Redirect) => void;
}) {
    if (redirects.length === 0) {
        return (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-base-300/60 bg-base-100 text-sm text-base-content/55">
                No redirects yet. Add one on the right to get started.
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-base-300/60 bg-base-100">
            <table className="w-full text-sm">
                <thead className="bg-base-200/60 text-xs uppercase tracking-wide text-base-content/65">
                    <tr>
                        <th className="px-4 py-2 text-left">From</th>
                        <th className="px-4 py-2 text-left">To</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-right">Hits</th>
                        <th className="px-4 py-2"></th>
                    </tr>
                </thead>
                <tbody>
                    {redirects.map((redirect) => (
                        <tr
                            key={redirect.id}
                            className={
                                redirect.id === activeId
                                    ? 'bg-primary/5'
                                    : 'border-t border-base-200/70'
                            }
                        >
                            <td className="px-4 py-2 font-mono text-xs text-base-content/85">
                                {redirect.from_path}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-base-content/85">
                                {redirect.to_path}
                            </td>
                            <td className="px-4 py-2 text-xs">
                                <span className="rounded bg-base-200/80 px-1.5 py-0.5 font-medium text-base-content/75">
                                    {redirect.match_type}
                                </span>
                            </td>
                            <td className="px-4 py-2 text-xs">
                                <span className="font-mono">
                                    {redirect.status_code}
                                </span>
                                {!redirect.is_active && (
                                    <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                                        Disabled
                                    </span>
                                )}
                            </td>
                            <td className="px-4 py-2 text-right text-xs text-base-content/65">
                                {redirect.hits.toLocaleString()}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2 text-right">
                                <button
                                    type="button"
                                    onClick={() => onEdit(redirect)}
                                    className="rounded-md border border-base-300/60 bg-base-100 px-2 py-1 text-xs font-semibold text-base-content/75 hover:bg-base-200"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(redirect)}
                                    className="ml-1 rounded-md border border-error/30 bg-base-100 px-2 py-1 text-xs font-semibold text-error hover:bg-error/10"
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const inputClass =
    'h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary';

function Field({
    label,
    hint,
    error,
    input,
}: {
    label: string;
    hint?: string;
    error?: string;
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

Redirects.layout = (page: ReactNode) => (
    <KeystoneAdminLayout>{page}</KeystoneAdminLayout>
);
