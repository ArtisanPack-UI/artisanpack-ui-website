import {
    useEffect,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from 'react';
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
import { type EditorViewMode } from '@/lib/admin/editorChrome';

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
    /**
     * Editor chrome view mode (issue #239). `normal` and `full-width` render
     * the two-column grid (full-width simply gets more room once the admin
     * sidebar is hidden); `distraction-free` collapses to one column and
     * moves the settings sidebar into a slide-over drawer.
     */
    viewMode?: EditorViewMode;
    /** Whether the distraction-free settings drawer is open. */
    settingsOpen?: boolean;
    /** Close the distraction-free settings drawer. */
    onCloseSettings?: () => void;
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
    viewMode = 'normal',
    settingsOpen = false,
    onCloseSettings,
}: EditorPanelLayoutProps) {
    const [draggingId, setDraggingId] = useState<string | null>(null);

    // Below `lg` the grid below already folds to one column; this is the
    // behavioural half of the same breakpoint (issue #192). Drag-and-drop
    // is a poor fit for touch — dnd-kit's pointer sensor competes with the
    // page's own scrolling — and cross-column dragging is meaningless once
    // there is visibly only one column, so the `⋮` menu becomes the sole
    // reorder affordance.
    const isNarrow = useNarrowViewport();

    // Distraction-free moves the sidebar column into a slide-over drawer, so
    // there is no second column to drag between — turn dragging off for the
    // same reason narrow does, leaving the `⋮` menu as the reorder path.
    const distractionFree = viewMode === 'distraction-free';
    const dragOff = isNarrow || distractionFree;

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
                            dragEnabled={!dragOff}
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
            // at narrow widths (and in distraction-free): with nothing
            // listening, a press on a panel is never intercepted and the
            // browser's own touch scrolling is left alone.
            sensors={dragOff ? NO_SENSORS : sensors}
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
            {/*
             * Suppressed in distraction-free: the sidebar column lives in the
             * `inert`, off-canvas settings drawer there, so the default layout
             * (every panel in the sidebar) would point this link at a region
             * that can't take focus. The floating control is the affordance in
             * that mode instead.
             */}
            {!distractionFree && (
                <a
                    href={`#${columnRegionId(skipTarget)}`}
                    // `sr-only` is itself `position: absolute`; `not-sr-only`
                    // returns the link to the flow on focus, so it opens a
                    // real gap above the editor instead of overlaying it.
                    className="sr-only rounded-lg border border-primary/40 bg-base-100 px-3 py-2 text-xs font-semibold text-primary focus:not-sr-only focus:inline-flex focus:w-fit focus:items-center"
                >
                    Skip to editor panels
                </a>
            )}

            <div
                className={
                    distractionFree
                        ? 'grid grid-cols-1 gap-4'
                        : 'grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]'
                }
            >
                <div className="flex min-w-0 flex-col gap-4">
                    {editor}
                    {hoistSticky && stickyColumn !== null && renderStickyPublish(stickyColumn)}
                    {renderColumn('main')}
                </div>

                {/*
                 * Distraction-free lifts the settings sidebar into a
                 * slide-over so the writing column can fill the screen; every
                 * other mode keeps it inline. The panels render once either
                 * way — the sidebar column keeps its saved order and the ⋮
                 * menu still reorders it inside the drawer.
                 */}
                {distractionFree ? (
                    <SettingsDrawer open={settingsOpen} onClose={onCloseSettings}>
                        {sidebarTop}
                        {renderColumn('sidebar')}
                        {sidebarBottom}
                    </SettingsDrawer>
                ) : (
                    <aside className="flex flex-col gap-4">
                        {sidebarTop}
                        {renderColumn('sidebar')}
                        {sidebarBottom}
                    </aside>
                )}
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

/** Focusable descendants of `root`, in tab order, skipping hidden ones. */
function focusableWithin(root: HTMLElement): HTMLElement[] {
    const selector =
        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
        (element) =>
            (element.offsetParent !== null || element === document.activeElement) &&
            // A control inside an `inert` subtree (e.g. a collapsed
            // `CollapsibleCard` body) is still laid out, so `offsetParent`
            // passes it — but `focus()` on it is a no-op. Including it as the
            // first/last trap target would silently let Tab escape the dialog.
            element.closest('[inert]') === null,
    );
}

/**
 * The distraction-free settings slide-over (issue #239).
 *
 * Renders the settings sidebar as a right-hand drawer so the writing column
 * can fill the screen while publishing / metadata stay one click away.
 *
 * The drawer stays **mounted** across open/close and is driven by the `open`
 * prop — closed, it is `inert` (untabbable, hidden from AT) and slid off
 * canvas. Keeping it mounted preserves each panel's in-progress local state
 * (a half-typed new term, an open date picker) that unmounting would discard,
 * and `inert` — the same mechanism `CollapsibleCard` uses for a closed body —
 * keeps its controls out of the tab order without a `display:none` that would
 * kill the slide.
 *
 * The slide honours `prefers-reduced-motion`: `motion-reduce:transition-none`
 * makes the state change instant for those users while motion users get the
 * slide. Focus moves to the close button on open and returns to the control
 * that opened it on close; Tab is trapped inside the panel while open; Escape
 * is handled one layer up (`useEditorViewMode`) so it closes the drawer
 * before exiting the mode.
 */
function SettingsDrawer({
    open,
    onClose,
    children,
}: {
    open: boolean;
    onClose?: () => void;
    children: ReactNode;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const restoreRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        restoreRef.current = document.activeElement as HTMLElement | null;
        const raf = requestAnimationFrame(() => closeRef.current?.focus());

        return () => {
            cancelAnimationFrame(raf);
            // Hand focus back to whatever opened the drawer (the floating
            // Settings button) rather than leaving it on a now-inert control.
            restoreRef.current?.focus?.();
        };
    }, [open]);

    // Trap Tab within the panel while open — `aria-modal` promises the rest of
    // the page is inert to AT, so keyboard focus must not wander out behind it.
    function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
        if (event.key !== 'Tab' || !panelRef.current) {
            return;
        }
        const focusable = focusableWithin(panelRef.current);
        if (focusable.length === 0) {
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    }

    return (
        <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
            {/*
             * Backdrop, interactive only while open. A `<button>` so
             * click-to-dismiss is a real control, but out of the tab order and
             * hidden from AT — the dialog's own close button is the keyboard
             * path.
             */}
            {open && (
                <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    onClick={onClose}
                    className="absolute inset-0 bg-base-content/20"
                />
            )}
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Editor settings"
                // Closed: untabbable and hidden from AT, so the sidebar panels
                // it holds aren't a second, invisible copy in the tab order.
                inert={!open}
                onKeyDown={handleKeyDown}
                className={[
                    'absolute inset-y-0 right-0 flex w-full max-w-sm transform flex-col gap-4 overflow-y-auto border-l border-base-300/60 bg-base-100 p-4 shadow-2xl',
                    'transition-transform duration-200 motion-reduce:transition-none',
                    open ? 'translate-x-0' : 'translate-x-full',
                ].join(' ')}
            >
                <div className="flex items-center justify-between border-b border-base-300/60 pb-3">
                    <h2 className="text-sm font-semibold text-base-content">Settings</h2>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Close settings"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-base-300/60 text-base-content/70 hover:bg-base-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                    >
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
                            <path
                                d="M6 6l12 12M18 6L6 18"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
