import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Head, router } from '@inertiajs/react';
import { applyFilters, doAction } from '@artisanpack-ui/hooks-js';
import { keystoneConfirm } from '@/lib/admin/confirm';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { PageHeader } from '@/components/admin/keystone';
import { DashboardGrid, renderableWidgets } from '@/components/admin/dashboard/DashboardGrid';
import { StarterPicker } from '@/components/admin/dashboard/StarterPicker';
import { AddWidgetDrawer } from '@/components/admin/dashboard/AddWidgetDrawer';
import { WidgetSettingsModal } from '@/components/admin/dashboard/WidgetSettingsModal';
import { WidgetLayoutPopover } from '@/components/admin/dashboard/WidgetLayoutPopover';
import { DashboardSwitcher } from '@/components/admin/dashboard/DashboardSwitcher';
import { CreateDashboardModal } from '@/components/admin/dashboard/CreateDashboardModal';
import { destroy as destroyWidget, reorder as reorderWidgetsRoute } from '@/routes/admin/dashboards/widgets';
import { UpdateAvailableBanner } from '@/components/admin/UpdateAvailableBanner';
import type {
    AvailableWidgets,
    DashboardStarter,
    DashboardSummary,
    DashboardWithWidgets,
    Widget,
} from '@/types/keystone';

interface DashboardProps {
    dashboards: DashboardSummary[];
    current: DashboardWithWidgets;
    available_widgets: AvailableWidgets;
    starters: DashboardStarter[];
}

export default function Dashboard({ dashboards, current, available_widgets, starters }: DashboardProps) {
    // Fire `keystone.admin.dashboard.mount` once per mounted Dashboard so
    // analytics / usage-tracking plugins can log dashboard views. The
    // effect deps intentionally cover `current.id` so switching
    // dashboards re-fires. Args: `({ dashboardId, dashboardSlug })`.
    useEffect(() => {
        doAction('keystone.admin.dashboard.mount', {
            dashboardId:   current.id,
            dashboardSlug: current.slug,
        });
    }, [current.id, current.slug]);

    // Filter the available-widgets catalog and the persisted-widget list
    // before either is consumed downstream. `.widgets.available` lets a
    // plugin add, remove, or rewrite catalog entries (e.g. hide widgets
    // behind a feature flag or inject a plugin-owned widget without
    // touching the server manifest); `.widgets.list` rewrites the actual
    // widget instances rendered on this dashboard (e.g. force-collapse an
    // instance by returning it with `data.visible = false`, or drop a
    // stale row a plugin migrated away from). Args are
    // `(AvailableWidgets, { dashboardId, dashboardSlug })` and
    // `(Widget[], { dashboardId, dashboardSlug })` respectively.
    const filteredAvailableWidgets = useMemo(
        () => applyFilters<AvailableWidgets>(
            'keystone.admin.dashboard.widgets.available',
            available_widgets,
            { dashboardId: current.id, dashboardSlug: current.slug },
        ),
        [available_widgets, current.id, current.slug],
    );

    const filteredWidgets = useMemo(
        () => applyFilters<Widget[]>(
            'keystone.admin.dashboard.widgets.list',
            current.widgets,
            { dashboardId: current.id, dashboardSlug: current.slug },
        ),
        [current.widgets, current.id, current.slug],
    );

    // `filteredWidgets` may contain orphan rows whose `type` is no longer in
    // the catalog or whose `component` isn't registered. `DashboardGrid`
    // silently drops them, so we have to derive emptiness from what would
    // actually render, not the raw count, or the user lands on a blank page
    // instead of the empty-state placeholder.
    const serverWidgets = useMemo(
        () => renderableWidgets(filteredWidgets, filteredAvailableWidgets),
        [filteredWidgets, filteredAvailableWidgets],
    );

    // Local copy so drag-drop can apply an optimistic order before the
    // server round-trip. Resyncs whenever the server-rendered list changes
    // (e.g. after add/remove/reorder responses or navigating dashboards) by
    // the "store previous prop" pattern — preferable to a `useEffect` here
    // because the reset has to happen *during* render, not after, or the
    // grid flashes the stale local order for a frame after navigation.
    const [trackedServerWidgets, setTrackedServerWidgets] = useState<Widget[]>(serverWidgets);
    const [orderedWidgets, setOrderedWidgets] = useState<Widget[]>(serverWidgets);

    if (trackedServerWidgets !== serverWidgets) {
        setTrackedServerWidgets(serverWidgets);
        setOrderedWidgets(serverWidgets);
    }

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
    const [layoutWidgetId, setLayoutWidgetId] = useState<string | null>(null);

    const editingWidget = useMemo(
        () => orderedWidgets.find((widget) => widget.id === editingWidgetId) ?? null,
        [orderedWidgets, editingWidgetId],
    );

    // The editing widget references catalog data via its `type`. If the widget
    // (or its catalog entry) disappears mid-edit — e.g. the server stripped a
    // capability — close the modal rather than render against undefined.
    const editingCatalog = editingWidget ? filteredAvailableWidgets[editingWidget.type] : undefined;

    const layoutWidget = useMemo(
        () => orderedWidgets.find((widget) => widget.id === layoutWidgetId) ?? null,
        [orderedWidgets, layoutWidgetId],
    );

    const layoutCatalog = layoutWidget ? filteredAvailableWidgets[layoutWidget.type] : undefined;

    // Monotonic counter so an older PATCH's onError can't revert state that a
    // newer PATCH has already (successfully) advanced. Tracks the most recently
    // *issued* request; only the rollback for that id is allowed to fire.
    const latestReorderRequestId = useRef(0);

    function handleRemoveWidget(widgetId: string, widgetTitle: string) {
        // Run the pending remove through `.dashboard.grid.remove` so a
        // plugin can veto (return `false` — silent, subscriber owns the
        // user feedback) or rewrite the identifying pair (rename the
        // confirm-dialog title, redirect to a different widget id). The
        // filter runs BEFORE the confirm dialog so a subscriber can
        // suppress the raw `window.confirm` in favor of a themed one.
        const filtered = applyFilters<{ widgetId: string; widgetTitle: string } | false>(
            'keystone.admin.dashboard.grid.remove',
            { widgetId, widgetTitle },
            { dashboardId: current.id, dashboardSlug: current.slug },
        );
        if (false === filtered) {
            return;
        }

        if (!keystoneConfirm(`Remove “${filtered.widgetTitle}” from this dashboard?`)) {
            return;
        }

        router.delete(destroyWidget({ slug: current.slug, id: filtered.widgetId }).url, {
            preserveScroll: true,
            preserveState: true,
            only: ['current', 'available_widgets'],
        });
    }

    function handleReorderWidgets(orderedIds: string[]) {
        // Run the caller's optimistic id order through `.dashboard.grid.reorder`
        // so a plugin can veto the reorder (return `false` — silent, matches
        // the `.edit.delete` / `.router.navigate` convention) or rewrite the
        // ordering (e.g. clamp a "pinned" widget back to position 0). The
        // rewritten list still has to match the current visible set for the
        // reorder to proceed — the length/set validation below runs against
        // whatever the filter chain settled on, not the raw input.
        const filteredOrder = applyFilters<string[] | false>(
            'keystone.admin.dashboard.grid.reorder',
            orderedIds,
            { dashboardId: current.id, dashboardSlug: current.slug },
        );
        if (false === filteredOrder) {
            return;
        }

        const previous = orderedWidgets;
        const byId = new Map(previous.map((widget) => [widget.id, widget]));

        // Reject anything that isn't an exact permutation of the current
        // visible id set. A length-only check would let a filter return
        // `[a, a, c]` in place of `[a, b, c]`: the duplicate offsets the
        // missing entry so the lengths match, then the sequential
        // `visibleIter` lookup below desyncs and the persisted order
        // silently drops `b` while writing `a` twice. Also protects
        // against a stale ID set from a server-driven add/remove race
        // (the original bailout case).
        //
        // Every filtered id must also exist in the server-provided
        // `current.widgets` — the `.widgets.list` filter one layer up
        // can inject synthetic client-only widgets (docs suggest this
        // pattern for plugin-owned rows), and reordering with an id
        // the server doesn't recognize would send a corrupted payload
        // that either 422s or persists a nonsense order.
        const uniqueFilteredIds = new Set(filteredOrder);
        const currentWidgetIds = new Set(current.widgets.map((widget) => widget.id));
        if (
            uniqueFilteredIds.size !== filteredOrder.length ||
            uniqueFilteredIds.size !== previous.length ||
            !previous.every((widget) => uniqueFilteredIds.has(widget.id)) ||
            !filteredOrder.every((id) => currentWidgetIds.has(id))
        ) {
            return;
        }

        const next: Widget[] = filteredOrder.map((id: string) => byId.get(id) as Widget);

        // Thread the new visible order back into the full persisted layout,
        // keeping orphan and self-collapsed widgets at their original
        // positions. The server requires the reorder payload to include
        // every stored widget id (see DashboardController::reorderWidgets);
        // a payload of only visible ids would 422 the request as soon as
        // the dashboard holds an orphan or a hidden widget.
        const visibleIdSet = new Set(filteredOrder);
        const visibleIter = filteredOrder[Symbol.iterator]();
        const fullOrderIds = current.widgets.map((widget) => {
            if (visibleIdSet.has(widget.id)) {
                return visibleIter.next().value as string;
            }
            return widget.id;
        });

        const requestId = ++latestReorderRequestId.current;
        setOrderedWidgets(next);

        router.patch(
            reorderWidgetsRoute({ slug: current.slug }).url,
            { order: fullOrderIds },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['current', 'available_widgets'],
                onError: () => {
                    // Skip the rollback if a newer reorder has been issued
                    // since — its optimistic state already supersedes ours,
                    // and reverting would clobber a still-valid update.
                    if (requestId === latestReorderRequestId.current) {
                        setOrderedWidgets(previous);
                    }
                },
            },
        );
    }

    // Built-in trailing action row on the dashboard PageHeader. Run it
    // through `.dashboard.headerActions` so a plugin can prepend / append
    // controls, swap the Add-widget button for its own variant, or wrap
    // the row in extra chrome (e.g. a "Save layout" button for a plugin
    // that persists local reorders). Args:
    // `(ReactNode, { dashboardId, dashboardSlug })`.
    const defaultHeaderActions = (
        <>
            <DashboardSwitcher
                dashboards={dashboards}
                currentSlug={current.slug}
                onCreateClick={() => setCreateOpen(true)}
            />
            <button
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-content hover:bg-primary/90"
                onClick={() => setDrawerOpen(true)}
            >
                Add widget
            </button>
        </>
    );

    const headerActions = applyFilters<ReactNode>(
        'keystone.admin.dashboard.headerActions',
        defaultHeaderActions,
        { dashboardId: current.id, dashboardSlug: current.slug },
    );

    return (
        <>
            <Head title={current.name} />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title={current.name}
                    description="Your dashboard"
                    actions={headerActions}
                />

                <UpdateAvailableBanner />

                {orderedWidgets.length > 0 ? (
                    <DashboardGrid
                        widgets={orderedWidgets}
                        availableWidgets={filteredAvailableWidgets}
                        onRemoveWidget={handleRemoveWidget}
                        onReorderWidgets={handleReorderWidgets}
                        onEditWidget={(id) => setEditingWidgetId(id)}
                        onEditLayout={(id) => setLayoutWidgetId(id)}
                    />
                ) : (
                    <StarterPicker
                        dashboardSlug={current.slug}
                        starters={starters}
                        availableWidgets={filteredAvailableWidgets}
                    />
                )}
            </div>

            <AddWidgetDrawer
                open={drawerOpen}
                dashboardSlug={current.slug}
                availableWidgets={filteredAvailableWidgets}
                onClose={() => setDrawerOpen(false)}
            />

            <CreateDashboardModal open={createOpen} onClose={() => setCreateOpen(false)} />

            {editingWidget && editingCatalog && (
                <WidgetSettingsModal
                    open
                    widget={editingWidget}
                    catalog={editingCatalog}
                    dashboardSlug={current.slug}
                    onClose={() => setEditingWidgetId(null)}
                />
            )}

            {layoutWidget && layoutCatalog && (
                <WidgetLayoutPopover
                    open
                    widget={layoutWidget}
                    catalog={layoutCatalog}
                    dashboardSlug={current.slug}
                    onClose={() => setLayoutWidgetId(null)}
                />
            )}
        </>
    );
}

Dashboard.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
