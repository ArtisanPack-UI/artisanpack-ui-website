import { useRef, useState, type ReactNode } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { PageHeader } from '@/components/admin/keystone';
import {
    destroy as destroyDashboard,
    reorder as reorderDashboards,
    show as showDashboard,
    update as updateDashboard,
} from '@/routes/admin/dashboards';
import type { DashboardSummary } from '@/types/keystone';

interface ManageDashboardRow extends DashboardSummary {
    widget_count: number;
}

interface ManageProps {
    dashboards: ManageDashboardRow[];
}

export default function Manage({ dashboards }: ManageProps) {
    // Local copy so drag-drop applies an optimistic order before the round-
    // trip; resync via the "store previous prop" pattern when the server
    // reshapes the list (mirrors admin/Dashboard.tsx). Doing the resync in
    // render — not effect — prevents a stale-order flash on response.
    const [trackedDashboards, setTrackedDashboards] = useState<ManageDashboardRow[]>(dashboards);
    const [orderedDashboards, setOrderedDashboards] = useState<ManageDashboardRow[]>(dashboards);

    if (trackedDashboards !== dashboards) {
        setTrackedDashboards(dashboards);
        setOrderedDashboards(dashboards);
    }

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [savingId, setSavingId] = useState<number | null>(null);
    const [bannerError, setBannerError] = useState<string | null>(null);

    const latestReorderRequestId = useRef(0);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    function handleStartRename(dashboard: ManageDashboardRow) {
        setEditingId(dashboard.id);
        setEditingName(dashboard.name);
    }

    function handleSaveRename(dashboard: ManageDashboardRow) {
        // Re-entry guard: Enter can fire while a PATCH is still in flight,
        // which would otherwise issue a duplicate rename request.
        if (savingId === dashboard.id) {
            return;
        }

        const trimmed = editingName.trim();

        if ('' === trimmed || trimmed === dashboard.name) {
            setEditingId(null);
            return;
        }

        setBannerError(null);
        setSavingId(dashboard.id);
        router.patch(
            updateDashboard(dashboard.slug).url,
            { name: trimmed },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setBannerError(null);
                    setEditingId(null);
                },
                onError: (errors) => {
                    const firstKey = Object.keys(errors)[0];
                    setBannerError(firstKey ? (errors[firstKey] as string) : 'Could not rename dashboard.');
                },
                onFinish: () => setSavingId(null),
            },
        );
    }

    function handleSetDefault(dashboard: ManageDashboardRow) {
        if (dashboard.is_default) {
            return;
        }

        setBannerError(null);
        setSavingId(dashboard.id);
        router.patch(
            updateDashboard(dashboard.slug).url,
            { is_default: true },
            {
                preserveScroll: true,
                onSuccess: () => setBannerError(null),
                onError: (errors) => {
                    const firstKey = Object.keys(errors)[0];
                    setBannerError(firstKey ? (errors[firstKey] as string) : 'Could not change the default dashboard.');
                },
                onFinish: () => setSavingId(null),
            },
        );
    }

    function handleDelete(dashboard: ManageDashboardRow) {
        const remaining = orderedDashboards.length - 1;

        if (remaining < 1) {
            // The UI already disables the delete control on the last dashboard,
            // but cover the keyboard/programmatic path too — the service-level
            // guard would surface as a 422, which we'd rather not flash for
            // something the UI can prevent up front.
            setBannerError('You must keep at least one dashboard.');
            return;
        }

        const message =
            dashboard.widget_count > 0
                ? `Delete "${dashboard.name}"? Its ${dashboard.widget_count} widget${dashboard.widget_count === 1 ? '' : 's'} will be removed.`
                : `Delete "${dashboard.name}"?`;

        if (!window.confirm(message)) {
            return;
        }

        setBannerError(null);
        setSavingId(dashboard.id);
        router.delete(destroyDashboard(dashboard.slug).url, {
            preserveScroll: true,
            onSuccess: () => setBannerError(null),
            onError: (errors) => {
                const firstKey = Object.keys(errors)[0];
                setBannerError(firstKey ? (errors[firstKey] as string) : 'Could not delete dashboard.');
            },
            onFinish: () => setSavingId(null),
        });
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = orderedDashboards.findIndex((dashboard) => dashboard.id === active.id);
        const newIndex = orderedDashboards.findIndex((dashboard) => dashboard.id === over.id);

        if (-1 === oldIndex || -1 === newIndex) {
            return;
        }

        const previous = orderedDashboards;
        const next = arrayMove(orderedDashboards, oldIndex, newIndex);
        const requestId = ++latestReorderRequestId.current;

        setOrderedDashboards(next);

        router.patch(
            reorderDashboards().url,
            { order: next.map((dashboard) => dashboard.id) },
            {
                preserveScroll: true,
                preserveState: true,
                onError: (errors) => {
                    if (requestId === latestReorderRequestId.current) {
                        setOrderedDashboards(previous);
                        const firstKey = Object.keys(errors)[0];
                        setBannerError(firstKey ? (errors[firstKey] as string) : 'Could not save the new order.');
                    }
                },
            },
        );
    }

    return (
        <>
            <Head title="Manage dashboards" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Manage dashboards"
                    description="Rename, reorder, or set a default dashboard."
                    breadcrumbs={['Dashboards', 'Manage']}
                />

                {bannerError && (
                    <div
                        role="alert"
                        className="rounded-md border border-error/40 bg-error/10 px-4 py-3 text-sm text-error"
                    >
                        {bannerError}
                        <button
                            type="button"
                            className="ml-3 text-xs font-semibold underline"
                            onClick={() => setBannerError(null)}
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext
                        items={orderedDashboards.map((dashboard) => dashboard.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <ul className="flex flex-col gap-2">
                            {orderedDashboards.map((dashboard) => (
                                <SortableRow key={dashboard.id} id={dashboard.id}>
                                    <Row
                                        dashboard={dashboard}
                                        isEditing={editingId === dashboard.id}
                                        editingName={editingName}
                                        onChangeName={setEditingName}
                                        onStartRename={() => handleStartRename(dashboard)}
                                        onSaveRename={() => handleSaveRename(dashboard)}
                                        onCancelRename={() => setEditingId(null)}
                                        onSetDefault={() => handleSetDefault(dashboard)}
                                        onDelete={() => handleDelete(dashboard)}
                                        saving={savingId === dashboard.id}
                                        canDelete={orderedDashboards.length > 1}
                                    />
                                </SortableRow>
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>
            </div>
        </>
    );
}

interface SortableRowProps {
    id: number;
    children: ReactNode;
}

function SortableRow({ id, children }: SortableRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    };

    return (
        <li ref={setNodeRef} style={style} className="flex items-stretch gap-2 rounded-lg border border-base-300/60 bg-base-100 p-3">
            <button
                type="button"
                aria-label="Drag to reorder"
                className="flex w-8 cursor-grab items-center justify-center rounded-md text-base-content/45 hover:bg-base-200/60 hover:text-base-content"
                {...attributes}
                {...listeners}
            >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
                    <circle cx="9" cy="6" r="1.5" />
                    <circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" />
                    <circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" />
                    <circle cx="15" cy="18" r="1.5" />
                </svg>
            </button>
            <div className="flex flex-1 items-center gap-3">{children}</div>
        </li>
    );
}

interface RowProps {
    dashboard: ManageDashboardRow;
    isEditing: boolean;
    editingName: string;
    onChangeName: (value: string) => void;
    onStartRename: () => void;
    onSaveRename: () => void;
    onCancelRename: () => void;
    onSetDefault: () => void;
    onDelete: () => void;
    saving: boolean;
    canDelete: boolean;
}

function Row({
    dashboard,
    isEditing,
    editingName,
    onChangeName,
    onStartRename,
    onSaveRename,
    onCancelRename,
    onSetDefault,
    onDelete,
    saving,
    canDelete,
}: RowProps) {
    return (
        <>
            <div className="flex flex-1 flex-col gap-1">
                {isEditing ? (
                    <input
                        type="text"
                        aria-label="Dashboard name"
                        value={editingName}
                        disabled={saving}
                        onChange={(event) => onChangeName(event.target.value)}
                        onKeyDown={(event) => {
                            if (saving) {
                                return;
                            }
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                onSaveRename();
                            } else if (event.key === 'Escape') {
                                event.preventDefault();
                                onCancelRename();
                            }
                        }}
                        autoFocus
                        maxLength={120}
                        className="w-full rounded-md border border-base-300/60 bg-base-100 px-3 py-1.5 text-sm text-base-content focus:border-primary focus:outline-none"
                    />
                ) : (
                    <Link
                        href={showDashboard(dashboard.slug).url}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-base-content hover:underline"
                    >
                        {dashboard.name}
                        {dashboard.is_default && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
                                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-3 w-3">
                                    <path d="M12 2.5l2.92 5.92 6.58.95-4.75 4.62 1.12 6.51L12 17.77l-5.87 3.08 1.12-6.5L2.5 9.71l6.58-.96L12 2.5z" />
                                </svg>
                                Default
                            </span>
                        )}
                    </Link>
                )}
                <p className="text-xs text-base-content/60">
                    {dashboard.widget_count} widget{dashboard.widget_count === 1 ? '' : 's'}
                </p>
            </div>

            <div className="flex items-center gap-2">
                {isEditing ? (
                    <>
                        <button
                            type="button"
                            onClick={onSaveRename}
                            disabled={saving}
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-content hover:bg-primary/90 disabled:opacity-60"
                        >
                            Save
                        </button>
                        <button
                            type="button"
                            onClick={onCancelRename}
                            className="rounded-md px-3 py-1.5 text-xs font-semibold text-base-content/75 hover:bg-base-200/60"
                        >
                            Cancel
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={onStartRename}
                            className="rounded-md px-3 py-1.5 text-xs font-semibold text-base-content/85 hover:bg-base-200/60"
                        >
                            Rename
                        </button>
                        <button
                            type="button"
                            onClick={onSetDefault}
                            disabled={dashboard.is_default || saving}
                            className="rounded-md px-3 py-1.5 text-xs font-semibold text-base-content/85 hover:bg-base-200/60 disabled:opacity-40"
                        >
                            Set default
                        </button>
                        <button
                            type="button"
                            onClick={onDelete}
                            disabled={!canDelete || saving}
                            title={canDelete ? undefined : 'You must keep at least one dashboard.'}
                            className="rounded-md px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/10 disabled:opacity-40"
                        >
                            Delete
                        </button>
                    </>
                )}
            </div>
        </>
    );
}

Manage.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
