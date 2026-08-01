import { Link, usePage } from '@inertiajs/react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import type { ReactNode } from 'react';
import admin from '@/routes/admin';
import type { KeystoneSharedProps } from '@/types/keystone';

/**
 * Dashboard banner that announces a pending Keystone release.
 *
 * Driven entirely by the `keystone.updateAvailable` shared prop set in
 * HandleInertiaRequests; the prop is only populated for admins, so this
 * component is safe to mount on shared admin pages without an extra
 * role check. Renders nothing when there's no update pending — unless a
 * `keystone.admin.updateBanner` filter subscriber injects its own banner.
 */
export function UpdateAvailableBanner() {
    const { keystone } = usePage<KeystoneSharedProps & Record<string, unknown>>().props;
    const pending = keystone.updateAvailable;

    const builtIn: ReactNode = pending ? (
        <div
            role="status"
            className="flex flex-col gap-3 rounded-[var(--radius-box)] border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex flex-col gap-0.5">
                <div className="font-display text-sm font-semibold text-base-content">
                    Update available — Keystone {pending.latest_version}
                </div>
                <div className="text-xs text-base-content/70">
                    You&apos;re running {pending.current_version}. The pre-update snapshot is automatic; the
                    site goes into maintenance mode for a few minutes during install.
                </div>
            </div>
            <div className="flex items-center gap-2">
                {pending.release_url ? (
                    <a
                        href={pending.release_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-base-300/60 bg-base-100 px-3 py-1.5 text-xs font-semibold text-base-content/75 hover:bg-base-200"
                    >
                        Release notes
                    </a>
                ) : null}
                <Link
                    href={admin.settings.updates().url}
                    className="rounded-md bg-warning px-3 py-1.5 text-xs font-semibold text-warning-content hover:bg-warning/90"
                >
                    Review &amp; install
                </Link>
            </div>
        </div>
    ) : null;

    // Plugins can rewrite the banner tree — hide it, swap in a richer
    // release-notes preview, add a "postpone" button — through
    // `keystone.admin.updateBanner`. Args: `(ReactNode, pending | null)`;
    // return the (possibly replaced) node, or `null` to suppress. Runs
    // even when no update is pending so a plugin can inject a synthetic
    // banner for its own release channel.
    const filtered = applyFilters<ReactNode>('keystone.admin.updateBanner', builtIn, pending);
    return <>{filtered}</>;
}
