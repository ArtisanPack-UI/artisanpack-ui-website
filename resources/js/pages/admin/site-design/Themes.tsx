import { useRef, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, EmptyState, PageHeader } from '@/components/admin/keystone';
import { activate, destroy, store as uploadRoute } from '@/routes/admin/site-design/themes';
import type { KeystoneSharedProps } from '@/types/keystone';

interface ThemeRow {
    slug: string;
    name: string;
    version: string;
    description: string;
    author: string;
    is_active: boolean;
}

interface PageProps extends KeystoneSharedProps {
    themes: ThemeRow[];
    flash?: { success?: string; error?: string };
    errors?: Record<string, string>;
    [key: string]: unknown;
}

export default function Themes() {
    const { themes, flash, errors } = usePage<PageProps>().props;
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const uploadForm = useForm<{ theme: File | null; overwrite: boolean }>({
        theme: null,
        overwrite: false,
    });

    function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0] ?? null;
        uploadForm.setData('theme', file);
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (!uploadForm.data.theme) return;

        uploadForm.post(uploadRoute().url, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                uploadForm.reset();
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
        });
    }

    function handleActivate(theme: ThemeRow) {
        if (theme.is_active) return;
        if (!confirm(`Activate "${theme.name}"? Visitors will see the new theme immediately.`)) return;
        router.post(activate(theme.slug).url, {}, { preserveScroll: true });
    }

    function handleDelete(theme: ThemeRow) {
        if (theme.is_active) return;
        if (!confirm(`Remove "${theme.name}"? Files will be deleted from disk.`)) return;
        router.delete(destroy(theme.slug).url, { preserveScroll: true });
    }

    const uploadError = uploadForm.errors.theme ?? errors?.theme;

    return (
        <>
            <Head title="Themes" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Themes"
                    description="Upload, activate, and manage installed themes."
                    breadcrumbs={['Site Design', 'Themes']}
                />

                {flash?.success ? (
                    <Card className="border-success/30 bg-success/5 text-sm text-success">
                        {flash.success}
                    </Card>
                ) : null}

                {flash?.error ? (
                    <Card role="alert" className="border-error/40 bg-error/5 text-sm text-error">
                        {flash.error}
                    </Card>
                ) : null}

                <Card>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                        <div>
                            <div className="font-display text-base font-semibold text-base-content">Install a theme</div>
                            <div className="text-sm text-base-content/65">
                                Upload a <code className="rounded bg-base-200 px-1.5 py-0.5 font-mono text-[12px]">.zip</code> containing a <code className="rounded bg-base-200 px-1.5 py-0.5 font-mono text-[12px]">theme.json</code> at the root or in a single wrapping directory.
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            {/*
                              Safari on macOS greys out .zip files on first
                              open when accept is narrowed to just .zip +
                              application/zip — its UTI lookup misses some
                              archives on a cold load. Listing the legacy
                              MIME plus octet-stream keeps Safari's picker
                              usable. Server-side ThemeInstaller still
                              validates archive contents.
                            */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".zip,application/zip,application/x-zip-compressed,application/octet-stream"
                                onChange={handleFileChange}
                                className="block w-full cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-content hover:file:bg-primary/90"
                            />
                            <button
                                type="submit"
                                disabled={!uploadForm.data.theme || uploadForm.processing}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {uploadForm.processing ? 'Uploading…' : 'Upload theme'}
                            </button>
                        </div>

                        <label className="inline-flex items-center gap-2 text-xs text-base-content/65">
                            <input
                                type="checkbox"
                                checked={uploadForm.data.overwrite}
                                onChange={(e) => uploadForm.setData('overwrite', e.target.checked)}
                                className="h-3.5 w-3.5"
                            />
                            Overwrite if a theme with the same slug is already installed
                        </label>

                        {uploadError ? (
                            <div role="alert" className="rounded-md border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">
                                {uploadError}
                            </div>
                        ) : null}
                    </form>
                </Card>

                {themes.length === 0 ? (
                    <Card>
                        <EmptyState
                            title="No themes installed"
                            description="Upload a theme zip above to get started."
                        />
                    </Card>
                ) : (
                    <div className="grid grid-cols-12 gap-7">
                        {themes.map((theme) => {
                            // Built-in theme-card body. `.siteDesign.themes.card`
                            // wraps the whole tile so a plugin can swap in its
                            // own render (add a preview thumbnail, a "premium"
                            // badge, an upsell link) without forking this
                            // page. Args: `(ReactNode, { theme })`.
                            const defaultCard: ReactNode = (
                                <Card className="flex flex-col gap-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-display text-base font-semibold text-base-content">{theme.name}</div>
                                            {theme.version || theme.author ? (
                                                <div className="text-xs text-base-content/55">
                                                    {theme.version ? `v${theme.version}` : null}
                                                    {theme.version && theme.author ? ' · ' : null}
                                                    {theme.author}
                                                </div>
                                            ) : null}
                                        </div>
                                        {theme.is_active ? <ActiveBadge /> : null}
                                    </div>
                                    {theme.description ? (
                                        <div className="text-sm text-base-content/65">{theme.description}</div>
                                    ) : null}
                                    <div className="mt-auto flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleActivate(theme)}
                                            disabled={theme.is_active}
                                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            {theme.is_active ? 'Active' : 'Activate'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(theme)}
                                            disabled={theme.is_active}
                                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-base-300 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </Card>
                            );

                            const card = applyFilters<ReactNode>(
                                'keystone.admin.siteDesign.themes.card',
                                defaultCard,
                                { theme },
                            );

                            return <div key={theme.slug} className="col-span-12 sm:col-span-6 xl:col-span-4">{card}</div>;
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

Themes.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
