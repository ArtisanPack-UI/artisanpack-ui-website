import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PanelMenu from '@/components/admin/editor/PanelMenu';
import {
    EditorPanelChromeProvider,
    type EditorPanelChrome,
} from '@/components/admin/editor/panelChrome';
import { panelDefinition, panelLabel } from '@/components/admin/editor/panels/registry';
import { usePrefersReducedMotion } from '@/components/admin/editor/usePrefersReducedMotion';
import type {
    EditorColumn,
    PanelFocusRequest,
    PanelMove,
} from '@/components/admin/editor/useEditorLayout';

export interface SortablePanelProps {
    panelId: string;
    column: EditorColumn;
    isFirst: boolean;
    isLast: boolean;
    collapsed: boolean;
    /**
     * Whether pointer dragging is available. `false` below the editor's
     * narrow breakpoint (issue #192), where the `⋮` menu is the only
     * reorder affordance — see `EditorPanelLayout`.
     */
    dragEnabled: boolean;
    focusRequest: PanelFocusRequest | null;
    onMove: (panelId: string, move: PanelMove) => void;
    onToggleCollapsed: (panelId: string, collapsed: boolean) => void;
    onHide: (panelId: string) => void;
    children: ReactNode;
}

/**
 * One draggable panel: the dnd-kit sortable wrapper plus the header chrome
 * (drag handle, `⋮` menu, ⌘-arrow shortcuts) the panel renders inside its
 * own header via {@link EditorPanelChromeProvider}.
 *
 * The panel components themselves know nothing about any of this — they
 * render a `CollapsibleCard` (or, for Publish, their own header), and that
 * shared chrome pulls the controls out of context.
 */
export default function SortablePanel({
    panelId,
    column,
    isFirst,
    isLast,
    collapsed,
    dragEnabled,
    focusRequest,
    onMove,
    onToggleCollapsed,
    onHide,
    children,
}: SortablePanelProps) {
    const definition = panelDefinition(panelId);
    const label = panelLabel(panelId);
    const menuRef = useRef<HTMLButtonElement>(null);

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: panelId,
        data: { column, type: 'panel' },
        disabled: !dragEnabled,
    });

    const prefersReducedMotion = usePrefersReducedMotion();

    // A keyboard move that crosses columns unmounts the panel from one
    // React subtree and remounts it in the other, dropping focus to the
    // document. Re-claiming it here keeps a run of ⌘-arrow presses on the
    // same panel instead of stranding the user at the top of the page.
    useEffect(() => {
        if (focusRequest?.panelId === panelId) {
            menuRef.current?.focus();
        }
    }, [focusRequest, panelId]);

    const handleHeaderKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>): void => {
            // Either modifier: ⌘ is the Mac convention the issue specifies,
            // Ctrl the Windows/Linux equivalent for the same chord.
            if (!event.metaKey && !event.ctrlKey) {
                return;
            }

            const move = ARROW_MOVES[event.key];
            if (move === undefined) {
                return;
            }

            // Browsers map ⌘← / ⌘↑ to history-back and scroll-to-top, so a
            // bare handler would reorder the panel and navigate away from
            // the unsaved post at the same time.
            event.preventDefault();
            event.stopPropagation();
            onMove(panelId, move);
        },
        [onMove, panelId],
    );

    const chrome = useMemo<EditorPanelChrome>(
        () => ({
            panelId,
            collapsible: definition?.collapsible ?? true,
            collapsed,
            setCollapsed: (next: boolean) => onToggleCollapsed(panelId, next),
            onHeaderKeyDown: handleHeaderKeyDown,
            controls: (
                <div className="flex shrink-0 items-center gap-0.5">
                    {/*
                     * The handle is a pointer-only affordance, deliberately
                     * not focusable: every move it performs is also on the
                     * `⋮` menu right beside it and on the ⌘-arrow chords,
                     * so a focusable handle would add a tab stop that does
                     * nothing extra for keyboard users.
                     *
                     * It is dropped entirely below the narrow breakpoint
                     * rather than merely disabled — a grab cursor on
                     * something that can't be dragged reads as a bug, and
                     * on touch it would compete for the same pixels as the
                     * `⋮` menu that replaces it.
                     */}
                    {dragEnabled && (
                        <span
                            {...attributes}
                            {...listeners}
                            aria-hidden
                            tabIndex={-1}
                            data-panel-handle={panelId}
                            title={`Drag to move ${label}`}
                            // `/55` clears the 3:1 WCAG 1.4.11 floor for a
                            // graphical control against the card behind it
                            // (#193) while staying quieter than the `⋮`
                            // menu, which is the primary affordance.
                            className="grid h-7 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-base-content/55 hover:bg-base-200 hover:text-base-content/70 active:cursor-grabbing"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                <circle cx="9" cy="6" r="1.5" />
                                <circle cx="15" cy="6" r="1.5" />
                                <circle cx="9" cy="12" r="1.5" />
                                <circle cx="15" cy="12" r="1.5" />
                                <circle cx="9" cy="18" r="1.5" />
                                <circle cx="15" cy="18" r="1.5" />
                            </svg>
                        </span>
                    )}
                    <PanelMenu
                        ref={menuRef}
                        panelId={panelId}
                        label={label}
                        column={column}
                        isFirst={isFirst}
                        isLast={isLast}
                        collapsible={definition?.collapsible ?? true}
                        collapsed={collapsed}
                        hideable={definition?.hideable ?? true}
                        onMove={(move) => onMove(panelId, move)}
                        onToggleCollapsed={() => onToggleCollapsed(panelId, !collapsed)}
                        onHide={() => onHide(panelId)}
                    />
                </div>
            ),
        }),
        [
            attributes,
            collapsed,
            column,
            definition,
            dragEnabled,
            handleHeaderKeyDown,
            isFirst,
            isLast,
            label,
            listeners,
            onHide,
            onMove,
            onToggleCollapsed,
            panelId,
        ],
    );

    return (
        <div
            ref={setNodeRef}
            data-panel-id={panelId}
            style={{
                transform: CSS.Translate.toString(transform),
                // dnd-kit's transition is an inline style, which outranks
                // the stylesheet's `prefers-reduced-motion` block — so the
                // reorder animation played for exactly the users who
                // asked it not to. Dropping the value here leaves the
                // reorder instant, which is the point.
                transition: prefersReducedMotion ? undefined : transition,
            }}
            className={isDragging ? 'relative z-30 opacity-60' : undefined}
        >
            <EditorPanelChromeProvider value={chrome}>{children}</EditorPanelChromeProvider>
        </div>
    );
}

/** Arrow key => the move it performs when chorded with ⌘ / Ctrl. */
const ARROW_MOVES: Record<string, PanelMove | undefined> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'main',
    ArrowRight: 'sidebar',
};
