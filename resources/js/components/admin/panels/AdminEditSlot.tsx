import { Suspense, useMemo, type ComponentType, type ReactNode } from 'react';
import { usePage } from '@inertiajs/react';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { AdminEditTabs } from './AdminEditTabs';
import { resolveBuiltinPanel, type PanelComponentProps } from './registry';
import type {
    ContentEditEntry,
    ContentEditPayload,
    PanelContext,
    SlotName,
} from './types';
import { resolveFederatedComponent } from '@/lib/plugins/federated-component-resolver';

/**
 * Renders every plugin panel registered against a given edit-screen
 * slot for the current content type / record. The framework's
 * `ContentEditExtensions` manager owns the filter registry — this
 * component just consumes the resolved list Keystone shared on the
 * Inertia payload and mounts each panel behind an error boundary.
 *
 * Slot semantics:
 *  - `sidebar-top` → entries with `position: 'top'`
 *  - `sidebar-bottom` → entries with `position: 'bottom'` or `'default'`
 *  - `tabs` → mounted through {@link AdminEditTabs} as a real tab strip
 *    with selection state and ARIA roles, not as sibling divs
 *  - `before-editor` / `after-editor` → linear list, no position split
 *
 * Panel resolution priority:
 *  1. Keystone-owned built-in registry (see `./registry.ts`)
 *  2. Federated Module Federation remote (when the entry carries
 *     `remote`/`entry`/`module` metadata)
 *  3. Skipped, with a console warning
 *
 * Each panel is wrapped in a {@link PanelErrorBoundary} so a broken
 * plugin panel can never take down the whole edit screen.
 */
export default function AdminEditSlot({
    slot,
    contentType,
    record,
}: {
    slot: SlotName;
    contentType: string;
    record: Record<string, unknown>;
}) {
    const page = usePage<{ contentEdit?: ContentEditPayload }>();
    const contentEdit = page.props.contentEdit;

    const entries = useMemo(
        () => (contentEdit ? entriesForSlot(contentEdit, slot) : []),
        [contentEdit, slot],
    );

    if (entries.length === 0) {
        return null;
    }

    const context: PanelContext = { contentType, record };

    if (slot === 'tabs') {
        return (
            <AdminEditTabs
                entries={entries}
                render={(entry) => (
                    <PanelErrorBoundary
                        // Key by slug so a tab that threw doesn't leave
                        // its stored error state behind for the next
                        // tab to inherit — the boundary is at the same
                        // JSX position across active-tab switches, so
                        // React would otherwise reuse the instance.
                        key={entry.slug}
                        slug={entry.slug}
                        pluginName={entry.remote}
                    >
                        <PanelBody entry={entry} context={context} />
                    </PanelErrorBoundary>
                )}
            />
        );
    }

    return (
        <>
            {entries.map((entry) => (
                <PanelErrorBoundary
                    key={entry.slug}
                    slug={entry.slug}
                    pluginName={entry.remote}
                >
                    <PanelBody entry={entry} context={context} />
                </PanelErrorBoundary>
            ))}
        </>
    );
}

/**
 * Resolves and mounts the panel component described by `entry`. The
 * built-in registry check is synchronous; federated remotes go through
 * a lazy-loaded component so Inertia can commit the slot layout before
 * the remote bundle arrives, and Suspense keeps the surrounding form
 * usable while the fetch is in flight.
 */
function PanelBody({
    entry,
    context,
}: {
    entry: ContentEditEntry;
    context: PanelContext;
}): ReactNode {
    const builtin = resolveBuiltinPanel(entry);
    if (builtin) {
        return renderPanel(builtin, entry, context);
    }

    if (entry.remote && entry.entry && entry.module) {
        // Federated panels can't render on the server — the plugin
        // bundles load over Module Federation at runtime. Return null
        // during SSR (mirroring the full-page `FederatedSsrPlaceholder`
        // in `resources/js/ssr.tsx`); the client mounts the real
        // component on hydration.
        if ('undefined' === typeof window) {
            return null;
        }

        return (
            <Suspense fallback={<PanelLoadingFallback />}>
                <FederatedPanel entry={entry} context={context} />
            </Suspense>
        );
    }

    if (import.meta.env.DEV) {
        console.warn(
            `[keystone] edit-screen panel "${entry.slug}" references unknown component "${entry.component}" — dropping.`,
        );
    }

    return null;
}

function renderPanel(
    Component: ComponentType<PanelComponentProps>,
    entry: ContentEditEntry,
    context: PanelContext,
) {
    const props = { ...entry.props, context } as PanelComponentProps;
    return <Component {...props} />;
}

/**
 * Federated remotes resolve through the shared plugin-component
 * helper Keystone uses for full-page plugin routes, so a plugin that
 * ships both a page and a panel from the same remote benefits from
 * one bundle cache instead of two competing caches. The helper's
 * cache is bounded so long-lived admin sessions can't leak lazy
 * wrappers per plugin rebuild.
 */
function FederatedPanel({
    entry,
    context,
}: {
    entry: ContentEditEntry;
    context: PanelContext;
}) {
    const Component = useMemo(
        () =>
            resolveFederatedComponent({
                remote: entry.remote as string,
                entry: entry.entry as string,
                module: entry.module as string,
            }),
        [entry.remote, entry.module, entry.entry],
    );

    return renderPanel(
        Component as unknown as ComponentType<PanelComponentProps>,
        entry,
        context,
    );
}

function PanelLoadingFallback() {
    return (
        <div className="animate-pulse rounded-lg border border-base-300/60 bg-base-200/40 px-4 py-6 text-center text-xs text-base-content/55">
            Loading panel…
        </div>
    );
}

function entriesForSlot(
    payload: ContentEditPayload,
    slot: SlotName,
): ContentEditEntry[] {
    switch (slot) {
        case 'tabs':
            return payload.tabs;
        case 'before-editor':
            return payload.beforeEditor;
        case 'after-editor':
            return payload.afterEditor;
        case 'sidebar-top':
            return payload.panels.filter((p) => p.position === 'top');
        case 'sidebar-bottom':
            return payload.panels.filter(
                (p) => p.position === 'bottom' || p.position === 'default',
            );
    }
}
