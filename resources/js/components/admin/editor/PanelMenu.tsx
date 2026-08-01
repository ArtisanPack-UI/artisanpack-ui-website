import {
    forwardRef,
    useCallback,
    useEffect,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from 'react';
import {
    EDITOR_COLUMN_LABELS,
    type EditorColumn,
    type PanelMove,
} from '@/components/admin/editor/useEditorLayout';

export interface PanelMenuProps {
    /** Panel this menu acts on — used for stable control ids. */
    panelId: string;
    /** Human label, so the trigger announces which panel it belongs to. */
    label: string;
    /** Column the panel currently sits in. */
    column: EditorColumn;
    /** True when the panel is already first in its column. */
    isFirst: boolean;
    /** True when the panel is already last in its column. */
    isLast: boolean;
    /** Whether "Collapse"/"Expand" is offered (Publish can't collapse). */
    collapsible: boolean;
    collapsed: boolean;
    /** Whether "Hide" is offered (Publish can't be hidden). */
    hideable: boolean;
    onMove: (move: PanelMove) => void;
    onToggleCollapsed: () => void;
    onHide: () => void;
}

/**
 * The `⋮` menu every panel header carries — the keyboard-and-pointer
 * equivalent of dragging the panel around (issue #190).
 *
 * This exists so reordering is never drag-only. WordPress shipped
 * drag-only metabox reordering and left keyboard users without an
 * equivalent for over a decade (Trac #39074, #50699); the menu here, plus
 * the ⌘-arrow shortcuts on the panel header, are the first-class path, and
 * dragging is the shortcut rather than the other way round.
 *
 * Items whose move would be a no-op are rendered `aria-disabled` rather
 * than omitted or natively disabled, so the menu's shape doesn't shift as
 * a panel travels and the arrow keys still reach them — the "Move up" item
 * stays in the same place, and is still announced, whether or not it's
 * available.
 *
 * Keyboard model (APG menu button, #193): Enter/Space or ↓ on the `⋮`
 * trigger opens the menu *and* moves focus onto the first item, ↑ onto the
 * last; ↓/↑/Home/End walk the items; Escape closes and returns focus to
 * the trigger; Tab leaves the menu and dismisses it.
 */
const PanelMenu = forwardRef<HTMLButtonElement, PanelMenuProps>(function PanelMenu(
    {
        panelId,
        label,
        column,
        isFirst,
        isLast,
        collapsible,
        collapsed,
        hideable,
        onMove,
        onToggleCollapsed,
        onHide,
    },
    triggerRef,
) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuId = `panel-menu-${panelId}`;

    /**
     * Every item, in DOM order — what the arrow keys walk.
     *
     * Disabled items included, per APG: a menu whose unavailable commands
     * are simply skipped tells a screen-reader user nothing about why
     * "Move up" wasn't there, and the item count shifts under them as the
     * panel moves. {@link MenuItem} marks them `aria-disabled` rather than
     * `disabled` so they stay focusable and announced, and no-ops on
     * activation.
     */
    const menuItems = useCallback(
        (): HTMLButtonElement[] =>
            Array.from(
                menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
            ),
        [],
    );

    /** Which end of the menu the pending open should land on. */
    const openFocusRef = useRef<'first' | 'last'>('first');

    // APG's menu-button pattern: opening moves focus *into* the menu, so a
    // keyboard user lands on "Move up" rather than having to Tab into a
    // popup that just appeared under their fingers. Without this the `⋮`
    // menu is reachable but not really operable — the panel behind it is
    // the next tab stop, not the menu.
    //
    // ↑ opens onto the *last* item, per the same pattern — it is what a
    // user reaching for "Hide" at the bottom of the list expects.
    useEffect(() => {
        if (!open) {
            return;
        }
        const items = menuItems();
        const target = openFocusRef.current === 'last' ? items[items.length - 1] : items[0];
        openFocusRef.current = 'first';
        target?.focus();
    }, [open, menuItems]);

    useEffect(() => {
        if (!open) {
            return;
        }

        // Captured up front so the cleanup detaches from the same node
        // even if the ref has since moved on.
        const container = containerRef.current;

        function handleClick(event: MouseEvent) {
            if (container && !container.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        function handleKey(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setOpen(false);
                // Escape from inside the menu would otherwise strand focus
                // on an unmounted item and send the next Tab back to the
                // top of the document.
                container?.querySelector('button')?.focus();
            }
        }

        // Keyboard counterpart to the outside-click dismiss: tabbing past
        // the last item moves focus to the next panel, and without this
        // the menu stays open overlaying it. A null `relatedTarget`
        // (window blur) deliberately does NOT close.
        function handleFocusOut(event: FocusEvent) {
            const next = event.relatedTarget as Node | null;
            if (next && container && !container.contains(next)) {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        container?.addEventListener('focusout', handleFocusOut);

        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
            container?.removeEventListener('focusout', handleFocusOut);
        };
    }, [open]);

    /**
     * Run an action and dismiss — every item is a one-shot command.
     *
     * Focus goes back to the trigger *before* the action, because the item
     * the user just activated unmounts with the menu and would otherwise
     * drop focus to the document body. Reorders re-claim focus themselves
     * through `focusRequest` (they remount the panel when it changes
     * column), but Collapse and Expand have no such path — this is the
     * only thing keeping them from stranding a keyboard user.
     */
    function run(action: () => void) {
        setOpen(false);
        containerRef.current?.querySelector('button')?.focus();
        action();
    }

    /**
     * Hide, which `run()` cannot serve: it removes the whole panel — the
     * trigger `run()` focuses included — so focusing the trigger first
     * just means focus lands on a node that is unmounted a moment later
     * and drops to `<body>`. A keyboard or screen-reader user then has to
     * restart tabbing from the top of a very long page.
     *
     * Screen Options is the destination because that is where the panel
     * can be restored from, which is exactly what the live region
     * announces ("Restore it from Screen Options"). The rAF waits for the
     * removal to commit so the focus call isn't undone by the re-render.
     */
    function runHide() {
        setOpen(false);
        onHide();

        requestAnimationFrame(() => {
            document.getElementById('screen-options-toggle')?.focus();
        });
    }

    /** ↓ / ↑ / Home / End walk the enabled items, wrapping at both ends. */
    function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
        const items = menuItems();
        if (items.length === 0) {
            return;
        }

        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        let next: number | null = null;

        if (event.key === 'ArrowDown') {
            next = current < 0 ? 0 : (current + 1) % items.length;
        } else if (event.key === 'ArrowUp') {
            next = current <= 0 ? items.length - 1 : current - 1;
        } else if (event.key === 'Home') {
            next = 0;
        } else if (event.key === 'End') {
            next = items.length - 1;
        }

        if (next === null) {
            return;
        }

        // ↑ / ↓ inside a menu scroll the page by default, which would slide
        // the panel out from under the menu the user is navigating.
        event.preventDefault();
        items[next]?.focus();
    }

    /**
     * ↓ / ↑ on the trigger open the menu, as the menu-button pattern
     * expects: ↓ lands on the first item, ↑ on the last. Enter and Space
     * are handled by the click handler and always land on the first.
     */
    function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
            return;
        }
        event.preventDefault();
        openFocusRef.current = event.key === 'ArrowUp' ? 'last' : 'first';
        setOpen(true);
    }

    return (
        <div ref={containerRef} className="relative">
            {/*
             * `type="button"` matters: the whole editor sits inside one
             * `<form>`, and a default `type="submit"` would save the record
             * on every menu click.
             */}
            <button
                ref={triggerRef}
                id={`panel-menu-toggle-${panelId}`}
                type="button"
                aria-label={`${label} panel options`}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen((previous) => !previous)}
                onKeyDown={handleTriggerKeyDown}
                // `max-lg:h-11 w-11` is the WCAG 2.5.5 44×44 minimum, applied
                // only where the pointer is likely a finger: below the
                // narrow breakpoint this is the *only* way to reorder a
                // panel, so it can't stay a 28px mouse target (issue #192).
                // `/60` rather than a lighter grey: an icon-only control is
                // a "graphical object" under WCAG 1.4.11 and has to clear
                // 3:1 against the card behind it (#193).
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-base-content/60 max-lg:h-11 max-lg:w-11 hover:bg-base-200 hover:text-base-content/80 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
                    <circle cx="12" cy="5" r="1.75" />
                    <circle cx="12" cy="12" r="1.75" />
                    <circle cx="12" cy="19" r="1.75" />
                </svg>
            </button>

            {open && (
                <div
                    ref={menuRef}
                    id={menuId}
                    role="menu"
                    aria-label={`${label} panel options`}
                    onKeyDown={handleMenuKeyDown}
                    className="absolute right-0 z-40 mt-1 w-56 rounded-lg border border-base-300/60 bg-base-100 p-1 text-left shadow-xl"
                >
                    <MenuItem
                        id={`${menuId}-up`}
                        disabled={isFirst}
                        shortcut={shortcutLabel('↑')}
                        keyshortcuts={reorderKeyShortcuts('ArrowUp')}
                        onClick={() => run(() => onMove('up'))}
                    >
                        Move up
                    </MenuItem>
                    <MenuItem
                        id={`${menuId}-down`}
                        disabled={isLast}
                        shortcut={shortcutLabel('↓')}
                        keyshortcuts={reorderKeyShortcuts('ArrowDown')}
                        onClick={() => run(() => onMove('down'))}
                    >
                        Move down
                    </MenuItem>
                    <MenuItem
                        id={`${menuId}-main`}
                        disabled={column === 'main'}
                        shortcut={shortcutLabel('←')}
                        keyshortcuts={reorderKeyShortcuts('ArrowLeft')}
                        onClick={() => run(() => onMove('main'))}
                    >
                        Move to {EDITOR_COLUMN_LABELS.main}
                    </MenuItem>
                    <MenuItem
                        id={`${menuId}-sidebar`}
                        disabled={column === 'sidebar'}
                        shortcut={shortcutLabel('→')}
                        keyshortcuts={reorderKeyShortcuts('ArrowRight')}
                        onClick={() => run(() => onMove('sidebar'))}
                    >
                        Move to {EDITOR_COLUMN_LABELS.sidebar}
                    </MenuItem>
                    {/*
                     * `role="separator"`: everything directly inside a
                     * `role="menu"` has to carry a menu-owned role, and a
                     * bare `<hr>` is `role="separator"` only by implicit
                     * mapping some engines don't apply inside a menu.
                     */}
                    {(collapsible || hideable) && (
                        <hr role="separator" className="my-1 border-base-300/60" />
                    )}
                    {collapsible && (
                        <MenuItem id={`${menuId}-collapse`} onClick={() => run(onToggleCollapsed)}>
                            {collapsed ? 'Expand' : 'Collapse'}
                        </MenuItem>
                    )}
                    {hideable && (
                        <MenuItem id={`${menuId}-hide`} onClick={runHide}>
                            Hide
                        </MenuItem>
                    )}
                </div>
            )}
        </div>
    );
});

/**
 * Render the reorder shortcut for the current platform. The handler
 * accepts either modifier, so the hint just has to match the key the user
 * would reach for: ⌘ on Apple hardware, Ctrl everywhere else.
 */
function shortcutLabel(arrow: string): string {
    const isApple =
        typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

    return isApple ? `⌘${arrow}` : `Ctrl+${arrow}`;
}

/**
 * The `aria-keyshortcuts` value for a reorder command. Both modifiers are
 * listed because the panel's key handler accepts either — the visible
 * `shortcut` hint only names the one the current platform uses, and that
 * hint is `aria-hidden` besides, so without this the shortcuts existed for
 * sighted mouse users only.
 */
function reorderKeyShortcuts(arrow: string): string {
    return `Meta+${arrow} Control+${arrow}`;
}

function MenuItem({
    id,
    children,
    shortcut,
    keyshortcuts,
    disabled = false,
    onClick,
}: {
    /** Stable id — the browser tests drive the menu through these. */
    id: string;
    children: ReactNode;
    /** Visible hint. Decorative — `aria-keyshortcuts` carries it to AT. */
    shortcut?: string;
    /** `aria-keyshortcuts` value, e.g. `"Meta+ArrowUp Control+ArrowUp"`. */
    keyshortcuts?: string;
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            id={id}
            type="button"
            role="menuitem"
            // Roving focus: the menu itself moves focus between items with
            // the arrow keys, so items are not individual tab stops. Tab
            // leaves the menu entirely, which the `focusout` handler above
            // reads as a dismissal.
            tabIndex={-1}
            // `aria-disabled` rather than the native `disabled` attribute:
            // native-disabled items are removed from the accessibility
            // tree and cannot hold focus, so the arrow keys skipped them
            // and a screen-reader user was never told the command existed
            // but was unavailable. APG asks for exactly this — present,
            // focusable, announced as disabled, inert on activation.
            aria-disabled={disabled || undefined}
            aria-keyshortcuts={keyshortcuts}
            onClick={() => {
                if (disabled) return;
                onClick();
            }}
            className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm text-base-content/85 max-lg:min-h-11 hover:bg-base-200/70 focus-visible:bg-base-200/70 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:text-base-content/35 aria-disabled:hover:bg-transparent"
        >
            <span>{children}</span>
            {shortcut && (
                <span aria-hidden className="text-xs text-base-content/70">
                    {shortcut}
                </span>
            )}
        </button>
    );
}

export default PanelMenu;
