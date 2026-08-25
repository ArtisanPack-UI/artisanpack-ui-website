import { useState, type ReactNode } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import {
    Card,
    DataTable,
    Icon,
    PageHeader,
    StatusBadge,
    type Tone,
} from '@/components/admin/keystone';
import {
    AddContentModal,
    type AddContentModalOption,
} from '@/components/admin/AddContentModal';
import { useAddContentModal } from '@/lib/admin/useAddContentModal';
import { useDateFormatter } from '@/lib/dateFormat';
import { keystoneConfirm } from '@/lib/admin/confirm';
import type { PostRow } from '@/types/keystone';
import { destroy, duplicate, edit } from '@/routes/admin/posts';

// Keyed by the full `PostRow['status']` union so a status the framework can
// persist but this screen forgot about is a type error rather than an
// undefined tone (#233). The hues mirror `actualStatusPillClass` in
// components/admin/editor/panels/PublishPanel.tsx — a record must not change
// colour between this list and its editor.
const statusTone: Record<PostRow['status'], Tone> = {
    published: 'success',
    draft: 'neutral',
    scheduled: 'info',
    private: 'warning',
};

type Tab = 'all' | PostRow['status'];

interface CategoryOption {
    value: number;
    label: string;
}

interface NewContentPayload {
    label: string;
    hierarchical: boolean;
    parentOptions: AddContentModalOption[];
    templates: AddContentModalOption[];
    quickCreateUrl: string;
}

interface PageProps {
    posts: PostRow[];
    categories: CategoryOption[];
    newContent: NewContentPayload;
    flash?: { success?: string; error?: string };
    [key: string]: unknown;
}

export default function Index() {
    const { posts, newContent, flash } = usePage<PageProps>().props;
    const { formatDate } = useDateFormatter();
    const [query, setQuery] = useState('');
    const [tab, setTab] = useState<Tab>('all');
    // #184 — landing from a "New post" menu link auto-opens the modal
    // (via `?new=1`); the hook also strips the parameter on close so a
    // reload or a Back doesn't reopen a dismissed dialog.
    const { open: modalOpen, openModal, closeModal } = useAddContentModal();

    const filtered = posts.filter((p) => {
        if (tab !== 'all' && p.status !== tab) return false;
        const normalizedQuery = query.toLowerCase();
        if (
            normalizedQuery &&
            !p.title.toLowerCase().includes(normalizedQuery) &&
            !p.slug.toLowerCase().includes(normalizedQuery)
        ) {
            return false;
        }
        return true;
    });

    const counts: Record<Tab, number> = {
        all: posts.length,
        published: posts.filter((p) => p.status === 'published').length,
        draft: posts.filter((p) => p.status === 'draft').length,
        scheduled: posts.filter((p) => p.status === 'scheduled').length,
        private: posts.filter((p) => p.status === 'private').length,
    };

    const tabs: Array<[Tab, string]> = [
        ['all', 'All'],
        ['published', 'Published'],
        ['draft', 'Drafts'],
        ['scheduled', 'Scheduled'],
        ['private', 'Private'],
    ];

    function handleDuplicate(post: PostRow) {
        router.post(duplicate(post.id).url, {}, { preserveScroll: true });
    }

    function handleDelete(post: PostRow) {
        if (!keystoneConfirm(`Delete "${post.title}"? This cannot be undone.`)) return;
        router.delete(destroy(post.id).url, { preserveScroll: true });
    }

    return (
        <>
            <Head title="Blog Posts" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Blog Posts"
                    description="Write and publish posts to your blog."
                    actions={
                        <button
                            id="new-content-trigger"
                            type="button"
                            onClick={openModal}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            {Icon.plus}
                            New post
                        </button>
                    }
                />

                <AddContentModal
                    open={modalOpen}
                    onClose={closeModal}
                    label={newContent.label}
                    hierarchical={newContent.hierarchical}
                    parentOptions={newContent.parentOptions}
                    templates={newContent.templates}
                    quickCreateUrl={newContent.quickCreateUrl}
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
                {flash?.error && (
                    <div
                        role="alert"
                        className="rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
                        {flash.error}
                    </div>
                )}

                <Card padded={false}>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300/60 px-4 py-3">
                        <div className="flex items-center gap-1">
                            {tabs.map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setTab(key)}
                                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold ${
                                        tab === key
                                            ? 'bg-base-200 text-base-content'
                                            : 'text-base-content/60 hover:text-base-content'
                                    }`}
                                >
                                    {label}
                                    <span className="rounded-full bg-base-200/80 px-1.5 text-[10px] text-base-content/60">
                                        {counts[key]}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div className="relative flex-1 max-w-xs">
                            <span className="pointer-events-none absolute top-2 left-2.5 text-base-content/60">
                                {Icon.search}
                            </span>
                            <input
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search posts…"
                                className="h-8 w-full rounded-md border border-base-300/60 bg-base-200/40 pr-3 pl-8 text-sm outline-none focus:border-primary focus:bg-base-100"
                            />
                        </div>
                    </div>

                    <DataTable<PostRow>
                        resource="posts"
                        columns={[
                            {
                                key: 'title',
                                label: 'Title',
                                render: (r) => (
                                    <div>
                                        <Link
                                            href={edit(r.id).url}
                                            className="font-semibold text-base-content hover:text-primary"
                                        >
                                            {r.title}
                                        </Link>
                                        <div className="font-mono text-[11px] text-base-content/70">
                                            {r.permalink}
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'status',
                                label: 'Status',
                                render: (r) => (
                                    <StatusBadge
                                        label={r.status}
                                        tone={statusTone[r.status]}
                                    />
                                ),
                            },
                            { key: 'category', label: 'Category', muted: true },
                            { key: 'author', label: 'Author', muted: true },
                            {
                                key: 'published_at',
                                label: 'Published',
                                muted: true,
                                render: (r) =>
                                    (r.published_at && formatDate(r.published_at)) ||
                                    '—',
                            },
                            {
                                key: 'actions',
                                label: '',
                                align: 'right',
                                render: (r) => (
                                    <div className="flex items-center justify-end gap-1">
                                        <RowAction
                                            as="link"
                                            href={edit(r.id).url}
                                            label={`Edit ${r.title}`}
                                            tooltip="Edit"
                                            icon={Icon.edit}
                                        />
                                        <RowAction
                                            onClick={() => handleDuplicate(r)}
                                            label={`Duplicate ${r.title}`}
                                            tooltip="Duplicate"
                                            icon={Icon.copy}
                                        />
                                        <RowAction
                                            onClick={() => handleDelete(r)}
                                            label={`Delete ${r.title}`}
                                            tooltip="Delete"
                                            icon={Icon.trash}
                                            tone="danger"
                                        />
                                    </div>
                                ),
                            },
                        ]}
                        rows={filtered}
                    />
                </Card>
            </div>
        </>
    );
}

interface RowActionProps {
    label: string;
    tooltip: string;
    icon: ReactNode;
    onClick?: () => void;
    href?: string;
    as?: 'button' | 'link';
    tone?: 'default' | 'danger';
}

function RowAction({
    label,
    tooltip,
    icon,
    onClick,
    href,
    as = 'button',
    tone = 'default',
}: RowActionProps) {
    const toneClass =
        tone === 'danger'
            ? 'hover:bg-error/10 hover:text-error focus-visible:text-error'
            : 'hover:bg-base-200 hover:text-base-content';

    const className =
        'group relative grid h-7 w-7 place-items-center rounded-md text-base-content/70 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
        toneClass;

    const inner = (
        <>
            <span aria-hidden>{icon}</span>
            <span className="sr-only">{label}</span>
            <span
                role="tooltip"
                aria-hidden
                className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-base-content px-2 py-1 text-[11px] font-medium text-base-100 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            >
                {tooltip}
            </span>
        </>
    );

    if (as === 'link' && href) {
        return (
            <Link href={href} className={className} aria-label={label} title={tooltip}>
                {inner}
            </Link>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className={className}
            aria-label={label}
            title={tooltip}
        >
            {inner}
        </button>
    );
}

Index.layout = (page: ReactNode) => (
    <KeystoneAdminLayout>{page}</KeystoneAdminLayout>
);
