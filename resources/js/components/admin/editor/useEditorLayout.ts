import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    defaultCollapsedPanelIds,
    panelIdsWithErrors,
    panelLabel,
    panelsForSupports,
    type EditorPanelDefinition,
} from '@/components/admin/editor/panels/registry';
import {
    resetEditorPreferences,
    saveEditorLayout,
    type EditorLayoutInput,
    type EditorPanelOrder,
    type EditorPreferencesPayload,
} from '@/lib/admin/editorPreferencesApi';

/**
 * How long to wait after the last change before persisting. Nudging a
 * panel up three slots, or ticking several Screen Options checkboxes in a
 * row, is one intent rather than three — the debounce collapses them into
 * a single PUT carrying the final layout.
 */
const SAVE_DEBOUNCE_MS = 400;

/**
 * Zero-width space appended to an otherwise-unchanged live-region message
 * so assistive tech treats it as new text and reads it again.
 */
const ANNOUNCEMENT_NUDGE = '\u200B';

/** The two columns a panel can live in. */
export type EditorColumn = 'main' | 'sidebar';

// `readonly` so a consumer can't splice the exported array and silently
// change the iteration order `resolveOrder`, `sameOrder`, and `columnOfIn`
// all depend on.
export const EDITOR_COLUMNS: readonly EditorColumn[] = ['main', 'sidebar'] as const;

/**
 * How each column is described in menu items and live announcements.
 * "Left"/"right" rather than "main"/"sidebar" because that is what the
 * user sees, and it matches the ⌘← / ⌘→ shortcuts that drive it.
 */
export const EDITOR_COLUMN_LABELS: Record<EditorColumn, string> = {
    main: 'left column',
    sidebar: 'right column',
};

/** Panel placement keyed by column. */
export type PanelColumns = Record<EditorColumn, string[]>;

/** A single keyboard / menu reorder command. */
export type PanelMove = 'up' | 'down' | 'main' | 'sidebar';

/**
 * A request to put keyboard focus back on a panel's menu button after a
 * move. `token` changes on every request so repeating the same move on the
 * same panel still re-focuses.
 */
export interface PanelFocusRequest {
    panelId: string;
    token: number;
}

export interface UseEditorLayoutResult {
    /** Panels Screen Options can toggle, in shipped order. */
    hideablePanels: EditorPanelDefinition[];
    /** Ids currently hidden — the value persisted for this post type. */
    hidden: string[];
    /** Flip one panel's visibility and schedule a save. */
    toggleHidden: (panelId: string) => void;
    /** Clear all saved layout state for this post type. */
    reset: () => void;
    /** Visible panel ids per column, in render order. */
    columns: PanelColumns;
    /** Which column a panel currently lives in, or `null` if unplaced. */
    columnOf: (panelId: string) => EditorColumn | null;
    /** Whether a panel's body is collapsed right now. */
    isCollapsed: (panelId: string) => boolean;
    /** Collapse or expand one panel and schedule a save. */
    setCollapsed: (panelId: string, collapsed: boolean) => void;
    /** Run a menu / keyboard move, announcing the result. */
    move: (panelId: string, move: PanelMove) => void;
    /** Reposition a panel mid-drag. Updates state without persisting. */
    dragMove: (panelId: string, toColumn: EditorColumn, toIndex: number) => void;
    /** Finish a drag: persist the current arrangement and announce it. */
    commitDrag: (panelId: string) => void;
    /** Current `aria-live` message, or `''` when there is nothing to say. */
    announcement: string;
    /** Panel whose menu button should take focus, or `null`. */
    focusRequest: PanelFocusRequest | null;
}

/**
 * Owns the editor's per-user, per-post-type panel layout (issues #189 and
 * #190): which panels are hidden, which are collapsed, and what order they
 * sit in across the two columns.
 *
 * State is optimistic: a change updates the UI immediately and the write is
 * debounced behind it. A failed write is swallowed rather than rolled back
 * — snapping a panel back to where it was is more confusing than a layout
 * that silently doesn't outlive the session, and the next successful change
 * re-sends the whole layout anyway.
 *
 * Every slice is mirrored into a ref alongside its state. A drag fires many
 * `dragMove` calls and one `commitDrag` within a single interaction, and
 * the commit has to persist the arrangement those calls just produced, not
 * the one React had rendered when the drag started.
 *
 * @param postType       Admin resource slug — `posts` or `pages`.
 * @param supports       The post type's `supports` flags, from the page props.
 * @param availableIds   Panel ids the edit screen actually renders a node
 *                       for. Narrower than `supports` alone: Custom fields
 *                       drops out when no fields are registered.
 * @param preferences    Saved layout hydrated from `editorPreferences`.
 * @param errors         Current form errors, so a panel holding one is
 *                       never hidden or collapsed out from under the user.
 */
export function useEditorLayout(
    postType: string,
    supports: string[],
    availableIds: string[],
    preferences: EditorPreferencesPayload,
    errors: Record<string, string>,
): UseEditorLayoutResult {
    const panels = useMemo(
        () => panelsForSupports(supports).filter((panel) => availableIds.includes(panel.id)),
        [supports, availableIds],
    );
    const panelIds = useMemo(() => panels.map((panel) => panel.id), [panels]);
    const hideablePanels = useMemo(() => panels.filter((panel) => panel.hideable), [panels]);

    const [hidden, setHiddenState] = useState<string[]>(preferences.hidden_panels);
    // Collapse state for a panel this screen doesn't render is meaningless
    // — unlike a hidden id, which #189 deliberately preserves so unhiding
    // later restores it. Drop those on hydration rather than round-tripping
    // them forever.
    const [collapsed, setCollapsedState] = useState<string[]>(() =>
        preferences.collapsed_panels.filter((id) => panelIds.includes(id)),
    );
    const [order, setOrderState] = useState<PanelColumns>(() =>
        resolveOrder(preferences.panel_order, panelIds),
    );
    const [announcement, setAnnouncement] = useState('');
    const [focusRequest, setFocusRequest] = useState<PanelFocusRequest | null>(null);

    const hiddenRef = useRef(hidden);
    const collapsedRef = useRef(collapsed);
    const orderRef = useRef(order);

    const erroredPanelIds = useMemo(() => panelIdsWithErrors(errors), [errors]);
    const erroredRef = useRef(erroredPanelIds);

    useEffect(() => {
        erroredRef.current = erroredPanelIds;
    }, [erroredPanelIds]);

    const isVisible = useCallback(
        (panelId: string): boolean =>
            !hidden.includes(panelId) || erroredPanelIds.includes(panelId),
        [hidden, erroredPanelIds],
    );

    /**
     * Visibility as of *now* rather than as of the last render. Reorder
     * maths runs inside event handlers and has to see the toggle the user
     * flipped a moment ago, which `hiddenRef` has but the rendered `hidden`
     * may not yet.
     */
    const isVisibleNow = useCallback(
        (panelId: string): boolean =>
            !hiddenRef.current.includes(panelId) || erroredRef.current.includes(panelId),
        [],
    );

    const setOrder = useCallback((next: PanelColumns): void => {
        orderRef.current = next;
        setOrderState(next);
    }, []);

    // A panel that appears (a content type gaining a supports flag, the
    // first custom field being registered) has to land somewhere. Append
    // it to the sidebar and drop ids that no longer render, so the stored
    // order never diverges from what is on screen.
    useEffect(() => {
        const reconciled = resolveOrder(orderRef.current, panelIds);
        if (!sameOrder(orderRef.current, reconciled)) {
            setOrder(reconciled);
        }
    }, [panelIds, setOrder]);

    const columns = useMemo<PanelColumns>(
        () => ({
            main: order.main.filter(isVisible),
            sidebar: order.sidebar.filter(isVisible),
        }),
        [order, isVisible],
    );

    const columnOf = useCallback(
        (panelId: string): EditorColumn | null => columnOfIn(orderRef.current, panelId),
        [],
    );

    // ---------------------------------------------------------------
    // Persistence
    // ---------------------------------------------------------------

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    /** Payload waiting behind the debounce timer, or `null` when idle. */
    const pendingRef = useRef<EditorLayoutInput | null>(null);

    /**
     * Send a layout now, aborting any write still in flight so a slow
     * earlier request can't land after — and overwrite — a later one.
     *
     * A rejection is swallowed: preferences are cosmetic and must never
     * interrupt an edit session. See the note above on why a failure
     * doesn't roll the layout back either.
     */
    const sendNow = useCallback(
        (layout: EditorLayoutInput): void => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            void saveEditorLayout(postType, layout, controller.signal).catch(() => {});
        },
        [postType],
    );

    /** Drop a queued save without sending it. */
    const discardPendingSave = useCallback((): void => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        pendingRef.current = null;
    }, []);

    // Flush rather than cancel on unmount: moving a panel and clicking
    // Back inside the debounce window is an easy thing to do, and dropping
    // the write there would silently lose the change. Inertia navigation
    // keeps the document alive, so the request still completes after this
    // component goes away.
    //
    // `postType` is a literal at every call site, so this cleanup only
    // ever runs on a real unmount, never on a dependency change.
    useEffect(() => {
        return () => {
            const pending = pendingRef.current;
            discardPendingSave();
            if (pending !== null) {
                // Via `sendNow` rather than a bare call so an older write
                // still in flight is aborted first — otherwise the two
                // race and the stale one can land last. Nothing aborts
                // this final request, so it runs to completion.
                sendNow(pending);
            }
        };
    }, [discardPendingSave, sendNow]);

    /**
     * Queue a write carrying the complete layout. The endpoint replaces
     * rather than merges, so every save has to name all three slices —
     * a partial payload would clear whichever one it left out.
     */
    const persistLayout = useCallback((): void => {
        const layout: EditorLayoutInput = {
            hidden_panels: hiddenRef.current,
            collapsed_panels: collapsedRef.current,
            panel_order: orderRef.current,
        };

        discardPendingSave();
        pendingRef.current = layout;
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            pendingRef.current = null;
            sendNow(layout);
        }, SAVE_DEBOUNCE_MS);
    }, [discardPendingSave, sendNow]);

    /**
     * Announce a layout change. A live region only re-reads when its text
     * actually changes, so an unchanged message gets a trailing zero-width
     * space — otherwise bumping a panel into the same wall twice would
     * announce once and then go silent.
     */
    const announce = useCallback((message: string): void => {
        setAnnouncement((previous) =>
            previous === message ? `${message}${ANNOUNCEMENT_NUDGE}` : message,
        );
    }, []);

    const requestFocus = useCallback((panelId: string): void => {
        setFocusRequest((previous) => ({ panelId, token: (previous?.token ?? 0) + 1 }));
    }, []);

    // ---------------------------------------------------------------
    // Mutations
    // ---------------------------------------------------------------

    const toggleHidden = useCallback(
        (panelId: string): void => {
            const current = hiddenRef.current;
            const next = current.includes(panelId)
                ? current.filter((id) => id !== panelId)
                : [...current, panelId];
            hiddenRef.current = next;
            setHiddenState(next);
            persistLayout();
            // Hiding from the panel's own menu removes the thing the user
            // was looking at, and the Screen Options checkbox that undoes
            // it is across the screen. Say so.
            announce(
                next.includes(panelId)
                    ? `${panelLabel(panelId)} hidden. Restore it from Screen Options.`
                    : `${panelLabel(panelId)} shown.`,
            );
        },
        [announce, persistLayout],
    );

    const setCollapsed = useCallback(
        (panelId: string, nextCollapsed: boolean): void => {
            const current = collapsedRef.current;
            const next = nextCollapsed
                ? [...current.filter((id) => id !== panelId), panelId]
                : current.filter((id) => id !== panelId);
            collapsedRef.current = next;
            setCollapsedState(next);
            persistLayout();
            announce(`${panelLabel(panelId)} ${nextCollapsed ? 'collapsed' : 'expanded'}.`);
        },
        [announce, persistLayout],
    );

    const isCollapsed = useCallback(
        // An error inside a collapsed panel forces it open on the same
        // rationale as a hidden one: `CollapsibleCard` marks a closed body
        // `inert`, so the message explaining a failed save would otherwise
        // be unreachable.
        (panelId: string): boolean =>
            collapsed.includes(panelId) && !erroredPanelIds.includes(panelId),
        [collapsed, erroredPanelIds],
    );

    const reset = useCallback((): void => {
        // Drop the queued change first — otherwise it would fire after the
        // reset and re-apply the layout the user just cleared.
        discardPendingSave();
        const collapsedDefaults = defaultCollapsedPanelIds(panelIds);
        hiddenRef.current = [];
        collapsedRef.current = collapsedDefaults;
        setHiddenState([]);
        setCollapsedState(collapsedDefaults);
        setOrder(defaultOrder(panelIds));
        announce('Editor layout reset to the default.');
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        void resetEditorPreferences(postType, controller.signal).catch(() => {
            // Same posture as a failed move — the panels are already back
            // where they belong; only the persisted row is out of date.
        });
    }, [announce, discardPendingSave, panelIds, postType, setOrder]);

    /** "Categories moved to position 2 of 5 in the right column." */
    const announcePlacement = useCallback(
        (panelId: string, column: EditorColumn): void => {
            const visible = orderRef.current[column].filter(isVisibleNow);
            announce(
                `${panelLabel(panelId)} moved to position ${visible.indexOf(panelId) + 1} of ${
                    visible.length
                } in the ${EDITOR_COLUMN_LABELS[column]}.`,
            );
        },
        [announce, isVisibleNow],
    );

    const move = useCallback(
        (panelId: string, direction: PanelMove): void => {
            const current = orderRef.current;
            const from = columnOfIn(current, panelId);
            if (from === null) {
                return;
            }

            if (direction === 'up' || direction === 'down') {
                const visible = current[from].filter(isVisibleNow);
                const index = visible.indexOf(panelId);
                const target = direction === 'up' ? index - 1 : index + 1;

                if (index === -1 || target < 0 || target >= visible.length) {
                    announce(
                        `${panelLabel(panelId)} is already ${
                            direction === 'up' ? 'first' : 'last'
                        } in the ${EDITOR_COLUMN_LABELS[from]}.`,
                    );
                    requestFocus(panelId);
                    return;
                }

                setOrder(placeIn(current, panelId, from, target, isVisibleNow));
                persistLayout();
                announcePlacement(panelId, from);
                requestFocus(panelId);
                return;
            }

            const to = direction;
            if (from === to) {
                announce(`${panelLabel(panelId)} is already in the ${EDITOR_COLUMN_LABELS[to]}.`);
                requestFocus(panelId);
                return;
            }

            // Column switches land at the bottom of the target column
            // rather than at the same index: the columns have different
            // lengths, so "keep the position" has no meaning, and
            // appending is the one outcome that is always predictable.
            setOrder(placeIn(current, panelId, to, Number.MAX_SAFE_INTEGER, isVisibleNow));
            persistLayout();
            announcePlacement(panelId, to);
            requestFocus(panelId);
        },
        [announce, announcePlacement, isVisibleNow, persistLayout, requestFocus, setOrder],
    );

    const dragMove = useCallback(
        (panelId: string, toColumn: EditorColumn, toIndex: number): void => {
            const current = orderRef.current;
            if (columnOfIn(current, panelId) === null) {
                return;
            }

            const next = placeIn(current, panelId, toColumn, toIndex, isVisibleNow);
            if (!sameOrder(current, next)) {
                setOrder(next);
            }
        },
        [isVisibleNow, setOrder],
    );

    const commitDrag = useCallback(
        (panelId: string): void => {
            const column = columnOfIn(orderRef.current, panelId);
            if (column === null) {
                return;
            }

            persistLayout();
            announcePlacement(panelId, column);
        },
        [announcePlacement, persistLayout],
    );

    return {
        hideablePanels,
        hidden,
        toggleHidden,
        reset,
        columns,
        columnOf,
        isCollapsed,
        setCollapsed,
        move,
        dragMove,
        commitDrag,
        announcement,
        focusRequest,
    };
}

/** Every available panel in the sidebar, in shipped order. */
function defaultOrder(panelIds: string[]): PanelColumns {
    return { main: [], sidebar: [...panelIds] };
}

function columnOfIn(order: PanelColumns, panelId: string): EditorColumn | null {
    return EDITOR_COLUMNS.find((column) => order[column].includes(panelId)) ?? null;
}

/**
 * Reconcile a saved (or previous) order against the panels that actually
 * render right now: keep placed ids in their saved column and position,
 * drop ids that no longer render, and append newly available ones to the
 * sidebar in shipped order.
 *
 * This is what makes an empty `panel_order` resolve to the shipped default
 * — with nothing placed, every id is "new" and lands in the sidebar.
 */
function resolveOrder(
    saved: EditorPanelOrder | null | undefined,
    panelIds: string[],
): PanelColumns {
    const placed = new Set<string>();
    const columns: PanelColumns = { main: [], sidebar: [] };

    for (const column of EDITOR_COLUMNS) {
        for (const id of saved?.[column] ?? []) {
            if (panelIds.includes(id) && !placed.has(id)) {
                placed.add(id);
                columns[column].push(id);
            }
        }
    }

    for (const id of panelIds) {
        if (!placed.has(id)) {
            columns.sidebar.push(id);
        }
    }

    return columns;
}

function sameOrder(a: PanelColumns, b: PanelColumns): boolean {
    return EDITOR_COLUMNS.every(
        (column) =>
            a[column].length === b[column].length &&
            a[column].every((id, index) => id === b[column][index]),
    );
}

/**
 * Put `panelId` at `toIndex` of `toColumn`, where `toIndex` counts only
 * the panels the user can actually see.
 *
 * Positions are computed against the visible sequence because that is what
 * the user is aiming at — a ⌘↓ that only swapped with a hidden neighbour
 * would look like nothing happened. {@link reflow} then folds the hidden
 * panels back in, each re-anchored behind the visible panel it previously
 * followed, so un-hiding one later restores it near where it was rather
 * than dumping it at the bottom of the column.
 */
function placeIn(
    order: PanelColumns,
    panelId: string,
    toColumn: EditorColumn,
    toIndex: number,
    isVisible: (panelId: string) => boolean,
): PanelColumns {
    const from = columnOfIn(order, panelId);
    if (from === null) {
        return order;
    }

    const target = order[toColumn].filter(isVisible).filter((id) => id !== panelId);
    const clamped = Math.max(0, Math.min(toIndex, target.length));
    target.splice(clamped, 0, panelId);

    const next: PanelColumns = { ...order, [toColumn]: reflow(order[toColumn], target) };

    if (from !== toColumn) {
        next[from] = order[from].filter((id) => id !== panelId);
    }

    return next;
}

/**
 * Fold a reordered *visible* sequence back into a column's full order,
 * hidden panels included. Leading hidden ids stay at the top; every other
 * one is re-inserted directly after the visible panel it previously
 * followed.
 */
function reflow(full: string[], nextVisible: string[]): string[] {
    const visible = new Set(nextVisible);
    const leading: string[] = [];
    const trailing = new Map<string, string[]>();
    let anchor: string | null = null;

    for (const id of full) {
        if (visible.has(id)) {
            anchor = id;
            continue;
        }
        if (anchor === null) {
            leading.push(id);
            continue;
        }
        trailing.set(anchor, [...(trailing.get(anchor) ?? []), id]);
    }

    return [...leading, ...nextVisible.flatMap((id) => [id, ...(trailing.get(id) ?? [])])];
}
