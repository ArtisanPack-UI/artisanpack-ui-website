import { useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import admin from '@/routes/admin';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, PageHeader, StatusBadge } from '@/components/admin/keystone';
import { keystoneConfirm } from '@/lib/admin/confirm';

type CheckStatus = 'ok' | 'no_url' | 'no_releases' | 'unauthorized' | 'not_found' | 'error';

interface UpdatesPayload {
    current_version: string;
    latest_version: string | null;
    changelog: string | null;
    release_date: string | null;
    release_url: string | null;
    has_update: boolean;
    check_status: CheckStatus;
    check_message: string | null;
    check_error: string | null;
    cached_at_iso: string | null;
    source_url: string;
    strategy: string;
    has_access_token: boolean;
}

interface UpdatesProps {
    updates: UpdatesPayload;
}

interface FlashShared {
    success?: string;
    error?: string;
    [key: string]: unknown;
}

interface UpdatesSharedProps {
    flash: FlashShared;
    [key: string]: unknown;
}

const CHANGELOG_PREVIEW_LINES = 12;

function changelogExcerpt(changelog: string | null): string {
    if (!changelog) {
        return '';
    }

    const lines = changelog.trim().split('\n');

    if (lines.length <= CHANGELOG_PREVIEW_LINES) {
        return changelog.trim();
    }

    return `${lines.slice(0, CHANGELOG_PREVIEW_LINES).join('\n')}\n…`;
}

/**
 * Render the appropriate inline message for the current check status.
 *
 * `no_releases` is an informational state (the source is reachable, the
 * project just hasn't tagged anything yet), so it gets a neutral/info
 * card. `unauthorized` / `no_url` are remediable setup issues — warning
 * tone with the remediation hint. Hard failures (`not_found`, `error`)
 * use the error tone and include the raw GitLab message.
 */
function renderCheckMessage(updates: UpdatesPayload): ReactElement | null {
    if (updates.check_status === 'ok') {
        return null;
    }

    if (updates.check_status === 'no_releases') {
        return (
            <div className="rounded-lg border border-info/30 bg-info/5 p-3 text-xs text-info">
                {updates.check_message}
            </div>
        );
    }

    if (updates.check_status === 'unauthorized' || updates.check_status === 'no_url') {
        return (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-base-content/80">
                {updates.check_message}
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-error/30 bg-error/5 p-3 text-xs text-error">
            <div>{updates.check_message ?? 'The release feed could not be reached.'}</div>
            {updates.check_error ? (
                <div className="mt-1 font-mono text-[11px] text-error/70">{updates.check_error}</div>
            ) : null}
        </div>
    );
}

export default function Updates({ updates }: UpdatesProps) {
    const { flash } = usePage<UpdatesSharedProps>().props;
    const [submitting, setSubmitting] = useState(false);
    const [checking, setChecking] = useState(false);

    // The page's release data is served from a 12h cache, so a release
    // published since the last check is invisible until the TTL lapses.
    // This drops the cached answer server-side and re-renders the page from
    // a fresh fetch — the in-admin equivalent of
    // `php artisan update:check --clear-cache`.
    function handleCheck() {
        if (checking || submitting) {
            return;
        }

        setChecking(true);

        router.post(
            admin.settings.updates.check().url,
            {},
            {
                preserveScroll: true,
                onFinish: () => setChecking(false),
            },
        );
    }

    function handleUpdate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        // `checking` too: a re-check in flight is about to replace the
        // release data this install would act on, so starting the install
        // now could target a version the page is one response away from
        // superseding.
        if (!updates.has_update || submitting || checking) {
            return;
        }

        const confirmed = keystoneConfirm(
            `This will put the site in maintenance mode and install Keystone ${updates.latest_version ?? 'latest'}. Continue?`,
        );

        if (!confirmed) {
            return;
        }

        setSubmitting(true);

        router.post(
            admin.settings.updates.run().url,
            { version: updates.latest_version ?? '' },
            {
                preserveScroll: true,
                onFinish: () => setSubmitting(false),
            },
        );
    }

    return (
        <KeystoneAdminLayout>
            <Head title="Updates" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Updates"
                    description="Install the latest Keystone release. The framework snapshots files and the database before applying changes; on failure the snapshot is restored automatically."
                    breadcrumbs={['Settings', 'System', 'Updates']}
                />

                {flash?.success ? (
                    <Card className="border-success/30 bg-success/5">
                        <div className="text-sm font-semibold text-success">{flash.success}</div>
                    </Card>
                ) : null}

                {flash?.error ? (
                    <Card className="border-error/30 bg-error/5">
                        <div className="text-sm font-semibold text-error">{flash.error}</div>
                    </Card>
                ) : null}

                <div className="grid grid-cols-12 gap-7">
                    <Card className="col-span-12 lg:col-span-7">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-baseline justify-between gap-3">
                                <div>
                                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">
                                        Release status
                                    </div>
                                    <div className="mt-1 font-display text-lg font-semibold text-base-content">
                                        Keystone {updates.current_version}
                                    </div>
                                </div>
                                {updates.has_update ? (
                                    <StatusBadge label={`Update available — ${updates.latest_version}`} tone="warning" />
                                ) : updates.check_status === 'no_releases' ? (
                                    <StatusBadge label="No releases yet" tone="info" />
                                ) : updates.check_status === 'unauthorized' || updates.check_status === 'no_url' ? (
                                    <StatusBadge label="Setup needed" tone="warning" />
                                ) : updates.check_status === 'not_found' || updates.check_status === 'error' ? (
                                    <StatusBadge label="Check failed" tone="error" />
                                ) : (
                                    <StatusBadge label="Up to date" tone="success" />
                                )}
                            </div>

                            {renderCheckMessage(updates)}

                            <dl className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <dt className="text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">
                                        Latest version
                                    </dt>
                                    <dd className="mt-1 font-medium text-base-content">
                                        {updates.latest_version ?? '—'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">
                                        Released
                                    </dt>
                                    <dd className="mt-1 font-medium text-base-content">
                                        {updates.release_date
                                            ? new Date(updates.release_date).toLocaleDateString(undefined, {
                                                  year: 'numeric',
                                                  month: 'short',
                                                  day: 'numeric',
                                              })
                                            : '—'}
                                    </dd>
                                </div>
                            </dl>

                            {updates.changelog ? (
                                <div>
                                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">
                                        Changelog excerpt
                                    </div>
                                    <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-base-300/60 bg-base-200/40 p-3 text-xs leading-relaxed whitespace-pre-wrap text-base-content/85">
                                        {changelogExcerpt(updates.changelog)}
                                    </pre>
                                    {updates.release_url ? (
                                        <a
                                            href={updates.release_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                                        >
                                            View full release notes →
                                        </a>
                                    ) : null}
                                </div>
                            ) : null}

                            <form onSubmit={handleUpdate} className="flex items-center justify-end gap-3 border-t border-base-300/60 pt-4">
                                {/*
                                  * Deliberately outside the actions filter
                                  * below: a plugin that replaces the row to
                                  * gate installs behind an approval workflow
                                  * should not also remove the operator's
                                  * only in-admin way to refresh the feed.
                                  */}
                                <button
                                    type="button"
                                    onClick={handleCheck}
                                    disabled={checking || submitting}
                                    className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 px-4 py-2 text-xs font-semibold text-base-content/85 hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {checking ? 'Checking…' : 'Check for updates'}
                                </button>
                                {applyFilters<ReactNode>(
                                    // Route the built-in "Update now" action row
                                    // through `.settings.updates.actions` so a
                                    // plugin can prepend controls (e.g. a
                                    // "Snapshot only" button, a "Download the
                                    // installer" link) or replace the row
                                    // entirely (e.g. a plugin that gates
                                    // updates behind an approval workflow).
                                    // Args: `(ReactNode, { updates, submitting })`.
                                    'keystone.admin.settings.updates.actions',
                                    (
                                        <button
                                            type="submit"
                                            disabled={!updates.has_update || submitting || checking}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-content hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {submitting
                                                ? 'Installing…'
                                                : updates.has_update
                                                  ? `Update now to ${updates.latest_version}`
                                                  : 'No update available'}
                                        </button>
                                    ),
                                    { updates, submitting },
                                )}
                            </form>
                        </div>
                    </Card>

                    <Card className="col-span-12 lg:col-span-5">
                        <div className="flex flex-col gap-3">
                            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">
                                Source
                            </div>
                            <div className="text-sm text-base-content/85 break-all">{updates.source_url || '—'}</div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">
                                        Strategy
                                    </div>
                                    <div className="mt-1 font-mono text-xs text-base-content">{updates.strategy}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">
                                        Access token
                                    </div>
                                    <div className="mt-1 font-medium text-base-content">
                                        {updates.has_access_token ? 'Configured' : 'Not set'}
                                    </div>
                                </div>
                            </div>
                            <p className="mt-2 text-[11px] leading-relaxed text-base-content/60">
                                The daily scheduler refreshes this page&apos;s release feed in the background. Run{' '}
                                <code className="rounded bg-base-200/60 px-1 py-0.5">php artisan update:check-scheduled</code>{' '}
                                from the command line to force a re-check.
                            </p>
                        </div>
                    </Card>
                </div>
            </div>
        </KeystoneAdminLayout>
    );
}
