import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Head, router } from '@inertiajs/react';
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
    // `current.widgets` may contain orphan rows whose `type` is no longer in
    // the catalog or whose `component` isn't registered. `DashboardGrid`
    // silently drops them, so we have to derive emptiness from what would
    // actually render, not the raw count, or the user lands on a blank page
    // instead of the empty-state placeholder.
    const serverWidgets = useMemo(
        () => renderableWidgets(current.widgets, available_widgets),
        [current.widgets, available_widgets],
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
    const editingCatalog = editingWidget ? available_widgets[editingWidget.type] : undefined;

    const layoutWidget = useMemo(
        () => orderedWidgets.find((widget) => widget.id === layoutWidgetId) ?? null,
        [orderedWidgets, layoutWidgetId],
    );

    const layoutCatalog = layoutWidget ? available_widgets[layoutWidget.type] : undefined;

    // Monotonic counter so an older PATCH's onError can't revert state that a
    // newer PATCH has already (successfully) advanced. Tracks the most recently
    // *issued* request; only the rollback for that id is allowed to fire.
    const latestReorderRequestId = useRef(0);

    function handleRemoveWidget(widgetId: string, widgetTitle: string) {
        if (!window.confirm(`Remove “${widgetTitle}” from this dashboard?`)) {
            return;
        }

        router.delete(destroyWidget({ slug: current.slug, id: widgetId }).url, {
            preserveScroll: true,
            preserveState: true,
            only: ['current', 'available_widgets'],
        });
    }

    function handleReorderWidgets(orderedIds: string[]) {
        const previous = orderedWidgets;
        const byId = new Map(previous.map((widget) => [widget.id, widget]));
        const next: Widget[] = [];

        for (const id of orderedIds) {
            const widget = byId.get(id);
            if (widget) {
                next.push(widget);
            }
        }

        // If the optimistic list doesn't match what we had, bail out. This
        // protects against the grid handing us a stale ID set after a
        // server-driven add/remove race, which would otherwise drop widgets.
        if (next.length !== previous.length) {
            return;
        }

        // Thread the new visible order back into the full persisted layout,
        // keeping orphan and self-collapsed widgets at their original
        // positions. The server requires the reorder payload to include
        // every stored widget id (see DashboardController::reorderWidgets);
        // a payload of only visible ids would 422 the request as soon as
        // the dashboard holds an orphan or a hidden widget.
        const visibleIdSet = new Set(orderedIds);
        const visibleIter = orderedIds[Symbol.iterator]();
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

    return (
        <>
            <Head title={current.name} />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title={current.name}
                    description="Your dashboard"
                    actions={
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
                    }
                />

                <UpdateAvailableBanner />

                {orderedWidgets.length > 0 ? (
                    <DashboardGrid
                        widgets={orderedWidgets}
                        availableWidgets={available_widgets}
                        onRemoveWidget={handleRemoveWidget}
                        onReorderWidgets={handleReorderWidgets}
                        onEditWidget={(id) => setEditingWidgetId(id)}
                        onEditLayout={(id) => setLayoutWidgetId(id)}
                    />
                ) : (
                    <StarterPicker
                        dashboardSlug={current.slug}
                        starters={starters}
                        availableWidgets={available_widgets}
                    />
                )}
            </div>

            <AddWidgetDrawer
                open={drawerOpen}
                dashboardSlug={current.slug}
                availableWidgets={available_widgets}
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
