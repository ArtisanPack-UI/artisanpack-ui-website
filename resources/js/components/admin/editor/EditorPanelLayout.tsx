import { useState, type ReactNode } from 'react';
import {
    DndContext,
    MeasuringStrategy,
    PointerSensor,
    closestCorners,
    pointerWithin,
    useDroppable,
    useSensor,
    useSensors,
    type CollisionDetection,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
    type SensorDescriptor,
    type SensorOptions,
    type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortablePanel from '@/components/admin/editor/SortablePanel';
import { useNarrowViewport } from '@/components/admin/editor/useNarrowViewport';
import {
    EDITOR_COLUMNS,
    EDITOR_COLUMN_LABELS,
    type EditorColumn,
    type UseEditorLayoutResult,
} from '@/components/admin/editor/useEditorLayout';

/**
 * The panel hoisted to the top of the stack, and pinned there, once the
 * columns collapse. It owns the only Save button on the screen, so on a
 * phone — where every panel is one long scroll — it is the one thing that
 * must never be several screens away.
 */
const STICKY_PANEL_ID = 'publish';

/**
 * Sensor list handed to `DndContext` when dragging is off. A module
 * constant rather than a fresh `[]` so the context doesn't re-register its
 * (empty) sensor set on every render.
 */
const NO_SENSORS: SensorDescriptor<SensorOptions>[] = [];

/** Droppable id for a whole column, so an empty one still accepts a drop. */
function columnDroppableId(column: EditorColumn): string {
    return `editor-column-${column}`;
}

/** Anchor id the "skip to panels" link targets. */
function columnRegionId(column: EditorColumn): string {
    return `editor-panels-${column}`;
}

function isColumnDroppableId(id: UniqueIdentifier): boolean {
    return EDITOR_COLUMNS.some((column) => id === columnDroppableId(column));
}

/**
 * Prefer the droppable the pointer is literally inside, falling back to
 * corner distance only when it is inside none — and, among what it is
 * inside, prefer a panel over the column that contains it.
 *
 * `closestCorners` alone measures from the dragged panel's own corners, so
 * a tall panel dragged out of the sidebar still scores its old neighbours
 * as "closest" and the cross-column drop never registers. What the user is
 * aiming with is the pointer.
 *
 * The panel-over-column tiebreak matters because a column droppable always
 * overlaps its panels: dropping onto a neighbour means a specific index,
 * while dropping onto the column means only "somewhere in here". Letting
 * the column win would flatten every in-column drop into a no-op.
 */
const panelCollisionDetection: CollisionDetection = (args) => {
    const withinPointer = pointerWithin(args);
    const collisions = withinPointer.length > 0 ? withinPointer : closestCorners(args);
    const overPanels = collisions.filter((collision) => !isColumnDroppableId(collision.id));

    return overPanels.length > 0 ? overPanels : collisions;
};

export interface EditorPanelLayoutProps {
    /** Layout state and mutators — from `useEditorLayout`. */
    layout: UseEditorLayoutResult;
    /**
     * Rendered panel bodies keyed by panel id. An id with no entry (or a
     * `null` one) is skipped, which is how a post type opts out of a panel
     * the registry knows about but this screen can't render.
     *
     * The contract is a node that *renders* something, not merely a
     * non-null element. A component that returns `null` from inside itself
     * — `CustomFieldsSection` does when a plugin suppresses it through
     * `keystone.admin.customFields.section` — still occupies a slot in the
     * layout model, so Screen Options lists it and moving it does nothing
     * visible. React can't report that upward, and the alternative is
     * hoisting the plugin filter out of the component, which would break
     * its published signature. Keep the caller's gating (`supports`, field
     * count) authoritative instead.
     */
    panels: Record<string, ReactNode>;
    /**
     * Title, slug, and block editor. Pinned to the top of the main column
     * and never reorderable — the writing surface is the one thing on the
     * screen whose position isn't a preference.
     */
    editor: ReactNode;
    /** Plugin slot rendered above the sidebar panels. */
    sidebarTop?: ReactNode;
    /** Plugin slot rendered below the sidebar panels. */
    sidebarBottom?: ReactNode;
}

/**
 * The editor's two-column panel surface (issues #186 and #190).
 *
 * Panels are drag-reorderable within a column and between columns, with a
 * fully keyboard-accessible equivalent on every panel header (the `⋮` menu
 * and ⌘-arrow shortcuts — see `PanelMenu`). Every move is announced through
 * the `aria-live` region at the bottom of this component.
 *
 * Only a pointer sensor is registered. dnd-kit's `KeyboardSensor` would add
 * a *second*, differently-shaped keyboard model (grab, arrow, drop) on top
 * of the menu and shortcuts that are the primary path here; two competing
 * models on the same control is worse for keyboard users than one good one.
 *
 * Below `lg` (issue #192) the two columns stack into one, dragging is
 * switched off entirely in favour of that same menu, and Publish is pinned
 * to the top of the stack so Save is always one tap away.
 */
export default function EditorPanelLayout({
    layout,
    panels,
    editor,
    sidebarTop,
    sidebarBottom,
}: EditorPanelLayoutProps) {
    const [draggingId, setDraggingId] = useState<string | null>(null);

    // Below `lg` the grid below already folds to one column; this is the
    // behavioural half of the same breakpoint (issue #192). Drag-and-drop
    // is a poor fit for touch — dnd-kit's pointer sensor competes with the
    // page's own scrolling — and cross-column dragging is meaningless once
    // there is visibly only one column, so the `⋮` menu becomes the sole
    // reorder affordance.
    const isNarrow = useNarrowViewport();

    /** Visible, renderable panel ids in one column, top to bottom. */
    function renderableIds(column: EditorColumn): string[] {
        return layout.columns[column].filter((id) => Boolean(panels[id]));
    }

    // Which column Publish sits in, or `null` when it isn't on screen at
    // all (a post type could drop it, and Screen Options can't).
    const stickyColumn =
        EDITOR_COLUMNS.find((column) => renderableIds(column).includes(STICKY_PANEL_ID)) ?? null;
    const hoistSticky = isNarrow && stickyColumn !== null;

    /** What a column's droppable region actually renders, hoist applied. */
    function columnIds(column: EditorColumn): string[] {
        return renderableIds(column).filter((id) => !hoistSticky || id !== STICKY_PANEL_ID);
    }

    // Where "Skip to editor panels" lands. The main column sits directly
    // under the block editor, so prefer it when it holds anything; the
    // sidebar is the fallback (and the default layout's only column).
    //
    // Measured against `columnIds`, not the raw column: with Publish
    // hoisted out, a main column holding *only* Publish renders as an
    // empty region, and a skip link that lands on nothing is worse than
    // no skip link at all.
    const skipTarget: EditorColumn = columnIds('main').length > 0 ? 'main' : 'sidebar';

    // An 8px activation distance keeps a plain click on the handle from
    // registering as a drag, so the `⋮` menu right next to it stays
    // clickable at speed.
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    /**
     * Which column a drag is currently over. `over.id` is either a panel
     * (use its column) or a column's own droppable (use that column) — the
     * latter is what makes dropping into an empty column work.
     */
    function columnUnder(id: UniqueIdentifier | undefined): EditorColumn | null {
        if (id === undefined) {
            return null;
        }
        if (id === columnDroppableId('main')) {
            return 'main';
        }
        if (id === columnDroppableId('sidebar')) {
            return 'sidebar';
        }
        return layout.columnOf(String(id));
    }

    function handleDragStart(event: DragStartEvent) {
        setDraggingId(String(event.active.id));
    }

    // Cross-column moves happen here rather than on drop so the panel
    // visibly lands in the other column while the pointer is still down —
    // without it the user drags into empty space with no feedback and has
    // to trust that releasing will do the right thing.
    function handleDragOver(event: DragOverEvent) {
        const { active, over } = event;
        const activeId = String(active.id);
        const target = columnUnder(over?.id);
        const source = layout.columnOf(activeId);

        if (target === null || source === null || source === target) {
            return;
        }

        const index =
            over?.id === columnDroppableId(target)
                ? layout.columns[target].length
                : layout.columns[target].indexOf(String(over?.id));

        layout.dragMove(activeId, target, index < 0 ? layout.columns[target].length : index);
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        const activeId = String(active.id);
        setDraggingId(null);

        const target = columnUnder(over?.id);
        if (target !== null && over?.id !== activeId && over?.id !== columnDroppableId(target)) {
            const index = layout.columns[target].indexOf(String(over?.id));
            if (index >= 0) {
                layout.dragMove(activeId, target, index);
            }
        }

        // Committed unconditionally: a cross-column move already landed in
        // `handleDragOver`, so even a release over nothing has a new
        // arrangement worth persisting.
        layout.commitDrag(activeId);
    }

    function handleDragCancel() {
        setDraggingId(null);
    }

    function renderColumn(column: EditorColumn): ReactNode {
        const ids = columnIds(column);

        return (
            <PanelDropZone
                column={column}
                isDragging={draggingId !== null}
                isEmpty={ids.length === 0}
            >
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    {ids.map((panelId, index) => (
                        <SortablePanel
                            key={panelId}
                            panelId={panelId}
                            column={column}
                            isFirst={index === 0}
                            isLast={index === ids.length - 1}
                            collapsed={layout.isCollapsed(panelId)}
                            dragEnabled={!isNarrow}
                            focusRequest={layout.focusRequest}
                            onMove={layout.move}
                            onToggleCollapsed={layout.setCollapsed}
                            onHide={layout.toggleHidden}
                        >
                            {panels[panelId]}
                        </SortablePanel>
                    ))}
                </SortableContext>
            </PanelDropZone>
        );
    }

    /**
     * Publish, lifted out of its column and pinned directly below the
     * block editor while the layout is stacked.
     *
     * Its `isFirst` / `isLast` come from `renderableIds` — its real
     * position in its real column, Publish included — because that is what
     * the `⋮` menu's Move up / Move down actually act on. The hoist is
     * presentation only; the saved order is untouched, and everything else
     * keeps the order the user chose.
     *
     * The other panels get their flags from `columnIds`, which excludes
     * Publish, so the two disagree by one slot while hoisted. That is
     * deliberate: their menus should describe the stack the user can see.
     * The cost is that a panel left alone beside Publish has both Move
     * items disabled — the move would be real but invisible at this width,
     * and it comes back the moment the viewport widens.
     *
     * `top-[60px]` clears the admin topbar, which is itself `sticky top-0
     * h-[60px]`; `z-20` sits under that topbar (`z-30`) and above the
     * panels it scrolls over.
     */
    function renderStickyPublish(column: EditorColumn): ReactNode {
        const ids = renderableIds(column);
        const index = ids.indexOf(STICKY_PANEL_ID);

        return (
            <div className="sticky top-[60px] z-20 rounded-xl shadow-lg shadow-base-content/10">
                {/*
                 * Its own context, since it has been excluded from its
                 * column's: `useSortable` needs *a* `SortableContext`
                 * ancestor even with dragging disabled.
                 */}
                <SortableContext items={[STICKY_PANEL_ID]} strategy={verticalListSortingStrategy}>
                    <SortablePanel
                        panelId={STICKY_PANEL_ID}
                        column={column}
                        isFirst={index === 0}
                        isLast={index === ids.length - 1}
                        collapsed={layout.isCollapsed(STICKY_PANEL_ID)}
                        dragEnabled={false}
                        focusRequest={layout.focusRequest}
                        onMove={layout.move}
                        onToggleCollapsed={layout.setCollapsed}
                        onHide={layout.toggleHidden}
                    >
                        {panels[STICKY_PANEL_ID]}
                    </SortablePanel>
                </SortableContext>
            </div>
        );
    }

    return (
        <DndContext
            // Emptying the sensor list is what actually turns dragging off
            // at narrow widths: with nothing listening, a press on a panel
            // is never intercepted and the browser's own touch scrolling
            // is left alone.
            sensors={isNarrow ? NO_SENSORS : sensors}
            collisionDetection={panelCollisionDetection}
            /*
             * Droppables are re-measured on every layout change rather than
             * once at drag start. An empty column only grows its drop
             * placeholder *after* `onDragStart` sets the dragging flag, so
             * a measure-once strategy records it as a zero-height rect and
             * it can never be dropped into.
             */
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            {/*
             * The block editor is a large focus trap of a region to tab
             * through, and every metadata panel sits after it in DOM order.
             * This link is the keyboard shortcut past it — it targets
             * whichever column actually holds panels, so a user who has
             * moved everything into the main column still lands on content
             * rather than an empty region.
             */}
            <a
                href={`#${columnRegionId(skipTarget)}`}
                // `sr-only` is itself `position: absolute`; `not-sr-only`
                // returns the link to the flow on focus, so it opens a
                // real gap above the editor instead of overlaying it.
                className="sr-only rounded-lg border border-primary/40 bg-base-100 px-3 py-2 text-xs font-semibold text-primary focus:not-sr-only focus:inline-flex focus:w-fit focus:items-center"
            >
                Skip to editor panels
            </a>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="flex min-w-0 flex-col gap-4">
                    {editor}
                    {hoistSticky && stickyColumn !== null && renderStickyPublish(stickyColumn)}
                    {renderColumn('main')}
                </div>

                <aside className="flex flex-col gap-4">
                    {sidebarTop}
                    {renderColumn('sidebar')}
                    {sidebarBottom}
                </aside>
            </div>

            {/*
             * Announces every reorder — drag and keyboard alike. `polite`
             * rather than `assertive` because a move is a confirmation of
             * something the user just did, not an interruption.
             */}
            <div role="status" aria-live="polite" className="sr-only">
                {layout.announcement}
            </div>
        </DndContext>
    );
}

/**
 * A column's droppable region. Always rendered — an empty column that
 * isn't droppable is a column you can never move the first panel into —
 * and it grows a dashed placeholder while a drag is in flight so the
 * target is visible rather than guessed at.
 */
function PanelDropZone({
    column,
    isDragging,
    isEmpty,
    children,
}: {
    column: EditorColumn;
    isDragging: boolean;
    isEmpty: boolean;
    children: ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: columnDroppableId(column),
        data: { column, type: 'column' },
    });

    return (
        <div
            ref={setNodeRef}
            id={columnRegionId(column)}
            // Focusable only as a skip-link destination, never as a tab
            // stop of its own.
            tabIndex={-1}
            role="region"
            aria-label={`Editor panels — ${EDITOR_COLUMN_LABELS[column]}`}
            data-editor-column={column}
            className={[
                'flex flex-col gap-4 rounded-xl transition-colors',
                isEmpty && isDragging
                    ? 'min-h-24 border-2 border-dashed border-base-300/70 p-3'
                    : '',
                isOver && isDragging ? 'bg-base-200/40' : '',
            ]
                .filter(Boolean)
                .join(' ')}
        >
            {children}
            {isEmpty && isDragging && (
                <p className="m-auto text-xs text-base-content/70">
                    Drop here to move into the {EDITOR_COLUMN_LABELS[column]}
                </p>
            )}
        </div>
    );
}
