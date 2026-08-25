import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, EmptyState, PageHeader } from '@/components/admin/keystone';
import {
    activate,
    checkUpdates as checkUpdatesRoute,
    deactivate,
    destroy,
    store as uploadRoute,
    update as updateRoute,
} from '@/routes/admin/system/plugins';
import type { KeystoneSharedProps } from '@/types/keystone';

/**
 * `applyFilters` hands back whatever a plugin's callback returned — a plugin
 * that returns a plain object (or forgets to return at all) would otherwise
 * throw inside React's render and take the whole Plugins page down with it,
 * rather than just losing its own customisation. Mirrors the
 * `Array.isArray` guard `KeystoneAdminLayout` puts on its notification-list
 * filter.
 *
 * Deliberately permissive: strings, numbers, booleans, null/undefined,
 * arrays and React elements (anything carrying `$$typeof`) all render fine.
 * Only a bare object or a function is rejected.
 */
function isRenderable(value: unknown): value is ReactNode {
    if (value === null || value === undefined) {
        return true;
    }

    if (Array.isArray(value)) {
        return value.every(isRenderable);
    }

    if (typeof value === 'object') {
        return '$$typeof' in value;
    }

    return ['string', 'number', 'boolean'].includes(typeof value);
}

interface PluginRow {
    slug: string;
    name: string;
    version: string;
    description: string;
    author: string;
    is_active: boolean;
    update_available: boolean;
    available_version: string;
}

interface PageProps extends KeystoneSharedProps {
    plugins: PluginRow[];
    flash?: { success?: string; warning?: string; error?: string };
    errors?: Record<string, string>;
    [key: string]: unknown;
}

export default function Plugins() {
    const { plugins, flash, errors } = usePage<PageProps>().props;
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Slugs whose lifecycle mutation (activate/deactivate/update/delete)
    // is currently in flight. A double-click on Activate would otherwise
    // fire two POSTs against the same plugin — race-y against migrations
    // and service-provider registration.
    const [pendingSlugs, setPendingSlugs] = useState<Set<string>>(new Set());

    function markPending(slug: string) {
        setPendingSlugs((prev) => {
            const next = new Set(prev);
            next.add(slug);
            return next;
        });
    }

    function clearPending(slug: string) {
        setPendingSlugs((prev) => {
            if (!prev.has(slug)) return prev;
            const next = new Set(prev);
            next.delete(slug);
            return next;
        });
    }

    const uploadForm = useForm<{ plugin: File | null }>({
        plugin: null,
    });

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0] ?? null;
        uploadForm.setData('plugin', file);
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!uploadForm.data.plugin) return;

        uploadForm.post(uploadRoute().url, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                uploadForm.reset();
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
        });
    }

    function handleActivate(plugin: PluginRow) {
        if (plugin.is_active || pendingSlugs.has(plugin.slug)) return;
        if (!confirm(`Activate "${plugin.name}"? This runs the plugin's migrations and registers its service provider.`)) return;
        markPending(plugin.slug);
        router.post(activate(plugin.slug).url, {}, {
            preserveScroll: true,
            onFinish: () => clearPending(plugin.slug),
        });
    }

    function handleDeactivate(plugin: PluginRow) {
        if (!plugin.is_active || pendingSlugs.has(plugin.slug)) return;
        if (!confirm(`Deactivate "${plugin.name}"? Any features it provides will be disabled.`)) return;
        markPending(plugin.slug);
        router.post(deactivate(plugin.slug).url, {}, {
            preserveScroll: true,
            onFinish: () => clearPending(plugin.slug),
        });
    }

    function handleUpdate(plugin: PluginRow) {
        if (!plugin.update_available || pendingSlugs.has(plugin.slug)) return;
        const version = plugin.available_version ? ` (v${plugin.available_version})` : '';
        if (!confirm(`Update "${plugin.name}"${version}?`)) return;
        markPending(plugin.slug);
        router.post(updateRoute(plugin.slug).url, {}, {
            preserveScroll: true,
            onFinish: () => clearPending(plugin.slug),
        });
    }

    function handleDelete(plugin: PluginRow) {
        if (pendingSlugs.has(plugin.slug)) return;
        if (!confirm(`Remove "${plugin.name}"? Files will be deleted from disk.`)) return;
        markPending(plugin.slug);
        router.delete(destroy(plugin.slug).url, {
            preserveScroll: true,
            onFinish: () => clearPending(plugin.slug),
        });
    }

    // Global (not per-slug) — the check-updates action fans out across
    // every installed plugin, so a single in-flight sentinel is right.
    const [checkingUpdates, setCheckingUpdates] = useState(false);

    function handleCheckUpdates() {
        if (checkingUpdates) return;
        setCheckingUpdates(true);
        router.post(checkUpdatesRoute().url, {}, {
            preserveScroll: true,
            onFinish: () => setCheckingUpdates(false),
        });
    }

    const uploadError = uploadForm.errors.plugin ?? errors?.plugin;
    const slugError = errors?.slug;

    return (
        <>
            <Head title="Plugins" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Plugins"
                    description="Install, activate, update, and manage plugins."
                    breadcrumbs={['System', 'Plugins']}
                    actions={
                        <button
                            type="button"
                            onClick={handleCheckUpdates}
                            disabled={checkingUpdates}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-base-300 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {checkingUpdates ? 'Checking…' : 'Check for updates'}
                        </button>
                    }
                />

                {flash?.success ? (
                    <Card className="border-success/30 bg-success/5 text-sm text-success">
                        {flash.success}
                    </Card>
                ) : null}

                {flash?.warning ? (
                    <Card className="border-warning/30 bg-warning/5 text-sm text-warning">
                        {flash.warning}
                    </Card>
                ) : null}

                {flash?.error ? (
                    <Card role="alert" className="border-error/40 bg-error/5 text-sm text-error">
                        {flash.error}
                    </Card>
                ) : null}

                {slugError ? (
                    <Card role="alert" className="border-error/40 bg-error/5 text-sm text-error">
                        {slugError}
                    </Card>
                ) : null}

                <Card>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                        <div>
                            <div className="font-display text-base font-semibold text-base-content">Install a plugin</div>
                            <div className="text-sm text-base-content/65">
                                Upload a <code className="rounded bg-base-200 px-1.5 py-0.5 font-mono text-[12px]">.zip</code> containing a <code className="rounded bg-base-200 px-1.5 py-0.5 font-mono text-[12px]">plugin.json</code> manifest.
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            {/*
                              Safari on macOS greys out .zip files on first
                              open when accept is narrowed to just .zip +
                              application/zip — its UTI lookup misses some
                              archives on a cold load. Listing the legacy
                              MIME plus octet-stream keeps Safari's picker
                              usable. Server-side plugin installer still
                              validates archive contents.
                            */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                // The "Install a plugin" heading above is a
                                // `div`, so it gives the input no accessible
                                // name — without this a screen reader
                                // announces only "file upload button".
                                aria-label="Install a plugin — choose a plugin zip"
                                accept=".zip,application/zip,application/x-zip-compressed,application/octet-stream"
                                onChange={handleFileChange}
                                className="block w-full cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-content hover:file:bg-primary/90"
                            />
                            <button
                                type="submit"
                                disabled={!uploadForm.data.plugin || uploadForm.processing}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {uploadForm.processing ? 'Uploading…' : 'Upload plugin'}
                            </button>
                        </div>

                        {uploadError ? (
                            <div role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">
                                {uploadError}
                            </div>
                        ) : null}
                    </form>
                </Card>

                {plugins.length === 0 ? (
                    <Card>
                        <EmptyState
                            title="No plugins installed"
                            description="Upload a plugin zip above to extend Keystone."
                        />
                    </Card>
                ) : (
                    <div className="grid grid-cols-12 gap-7">
                        {plugins.map((plugin) => {
                            const isPending = pendingSlugs.has(plugin.slug);
                            // Built-in action row for a plugin card. Route
                            // through `.plugins.actions` first so a plugin
                            // can inject controls (e.g. "View settings",
                            // "Report issue") without forking the page.
                            // Args: `(ReactNode, { plugin, isPending })`.
                            const defaultActions: ReactNode = (
                                <div className="mt-auto flex flex-wrap items-center gap-2">
                                    {plugin.is_active ? (
                                        <button
                                            type="button"
                                            onClick={() => handleDeactivate(plugin)}
                                            disabled={isPending}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-base-300 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            {isPending ? 'Working…' : 'Deactivate'}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleActivate(plugin)}
                                            disabled={isPending}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            {isPending ? 'Working…' : 'Activate'}
                                        </button>
                                    )}

                                    {plugin.update_available ? (
                                        <button
                                            type="button"
                                            onClick={() => handleUpdate(plugin)}
                                            disabled={isPending}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-xs font-semibold text-success-content shadow-sm hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Update
                                        </button>
                                    ) : null}

                                    <button
                                        type="button"
                                        onClick={() => handleDelete(plugin)}
                                        disabled={plugin.is_active || isPending}
                                        title={plugin.is_active ? 'Deactivate before removing' : undefined}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-base-300 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Remove
                                    </button>
                                </div>
                            );

                            const filteredActions = applyFilters<ReactNode>(
                                'keystone.admin.plugins.actions',
                                defaultActions,
                                { plugin, isPending },
                            );
                            const actions = isRenderable(filteredActions) ? filteredActions : defaultActions;

                            // Built-in card body — header, description, actions.
                            // `.plugins.card` filter wraps the whole card so a
                            // plugin can swap the entire tile (e.g. a plugin-
                            // owned "premium" look) or add chrome around it.
                            // Args: `(ReactNode, { plugin, isPending })`.
                            const defaultCard: ReactNode = (
                                <Card className="flex flex-col gap-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-display text-base font-semibold text-base-content">{plugin.name}</div>
                                            {plugin.version || plugin.author ? (
                                                <div className="text-xs text-base-content/55">
                                                    {plugin.version ? `v${plugin.version}` : null}
                                                    {plugin.version && plugin.author ? ' · ' : null}
                                                    {plugin.author}
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {plugin.is_active ? <ActiveBadge /> : <InactiveBadge />}
                                            {plugin.update_available ? <UpdateBadge version={plugin.available_version} /> : null}
                                        </div>
                                    </div>
                                    {plugin.description ? (
                                        <div className="text-sm text-base-content/65">{plugin.description}</div>
                                    ) : null}
                                    {actions}
                                </Card>
                            );

                            const filteredCard = applyFilters<ReactNode>(
                                'keystone.admin.plugins.card',
                                defaultCard,
                                { plugin, isPending },
                            );
                            const card = isRenderable(filteredCard) ? filteredCard : defaultCard;

                            return <div key={plugin.slug} className="col-span-12 sm:col-span-6 xl:col-span-4">{card}</div>;
                        })}
                    </div>
                )}
            </div>
        </>
    );
}

function ActiveBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            Active
        </span>
    );
}

function InactiveBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-base-300 bg-base-200/60 px-2 py-0.5 text-[11px] font-semibold text-base-content/60">
            Inactive
        </span>
    );
}

function UpdateBadge({ version }: { version: string }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-semibold text-info">
            Update{version ? ` v${version}` : ''} available
        </span>
    );
}

Plugins.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
