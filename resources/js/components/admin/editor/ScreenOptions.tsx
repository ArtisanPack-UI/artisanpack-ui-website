import { useEffect, useId, useRef, useState } from 'react';
import { type EditorPanelDefinition } from '@/components/admin/editor/panels/registry';

export interface ScreenOptionsProps {
    /**
     * Hideable panels available for this post type — `hideablePanels` from
     * `useEditorLayout`.
     */
    panels: EditorPanelDefinition[];
    /** Currently hidden panel ids. */
    hidden: string[];
    /** Flip one panel's visibility. */
    onToggle: (panelId: string) => void;
    /** Clear the saved layout for this post type. */
    onReset: () => void;
}

/**
 * WordPress-classic "Screen Options" dropdown for the editor header
 * (issue #189).
 *
 * Lists a checkbox per panel the current post type supports; unchecking
 * one hides it from the sidebar for this user. Panels the post type does
 * not support never appear — a user can't toggle something the content
 * type never renders. Publish is not listed: it isn't a `supports` flag
 * and, as in WordPress, is not hideable.
 *
 * Hiding a panel only stops it rendering. The parent form still owns the
 * value and still submits it, so hiding e.g. Excerpt never silently
 * clears an excerpt the user already wrote.
 *
 * The checkboxes track the *saved preference*, not what is currently on
 * screen. A hidden panel holding a validation error is forced back into
 * the sidebar (see `panelIdsWithErrors`) while its box stays unchecked —
 * showing it checked would misreport what was persisted, and the panel
 * disappears again on its own once the error clears.
 *
 * Reorder and column-switching live on each panel's own `⋮` menu (issue
 * #190). "Reset layout" clears the whole saved row, so it restores the
 * shipped order and collapse state alongside visibility.
 */
export default function ScreenOptions({ panels, hidden, onToggle, onReset }: ScreenOptionsProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelId = useId();

    useEffect(() => {
        if (!open) {
            return;
        }

        function handleClick(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        function handleKey(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setOpen(false);
                // Escape from inside the panel would otherwise strand
                // focus on an unmounted checkbox and send the next Tab
                // back to the top of the document.
                triggerRef.current?.focus();
            }
        }

        // Keyboard counterpart to the outside-click dismiss: tabbing past
        // the last checkbox moves focus to the next header control, and
        // without this the panel stays open overlaying the sidebar.
        //
        // A null `relatedTarget` (window blur, focus moving to no element)
        // deliberately does NOT close — switching browser tabs and coming
        // back should find the panel as you left it.
        function handleFocusOut(event: FocusEvent) {
            const next = event.relatedTarget as Node | null;
            if (next && container && !container.contains(next)) {
                setOpen(false);
            }
        }

        // Captured up front so the cleanup detaches from the same node
        // even if the ref has since moved on.
        const container = containerRef.current;

        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        container?.addEventListener('focusout', handleFocusOut);

        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
            container?.removeEventListener('focusout', handleFocusOut);
        };
    }, [open]);

    // Nothing to configure when the post type supports no hideable
    // panels — render nothing rather than an empty dropdown.
    if (panels.length === 0) {
        return null;
    }

    return (
        <div ref={containerRef} className="relative">
            <button
                ref={triggerRef}
                id="screen-options-toggle"
                type="button"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                // Deliberately no `aria-haspopup`: it maps to `menu`, and
                // what this reveals is a group of checkboxes, not a menu.
                // `aria-expanded` + `aria-controls` is the whole contract
                // for a disclosure, and mislabelling it as a menu would
                // promise arrow-key navigation that isn't there.
                onClick={() => setOpen((prev) => !prev)}
                // `max-lg:min-h-11` here and on the controls below is the
                // WCAG 2.5.5 44px minimum, applied only below the editor's
                // narrow breakpoint where the pointer is a finger (#192).
                className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/75 max-lg:min-h-11 hover:bg-base-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
                Screen Options
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
                >
                    <path
                        d="M6 9l6 6 6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </button>

            {open && (
                <div
                    id={panelId}
                    // Named after its own trigger so a screen reader reading
                    // the revealed region announces "Screen Options group"
                    // rather than an anonymous container.
                    role="group"
                    aria-labelledby="screen-options-toggle"
                    className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-base-300/60 bg-base-100 p-3 text-left shadow-xl"
                >
                    <fieldset>
                        <legend className="mb-2 text-[11px] font-semibold tracking-wide text-base-content/70 uppercase">
                            Panels
                        </legend>
                        <div className="flex flex-col gap-1.5">
                            {/*
                             * Ids are the stable `screen-option-<panelId>`
                             * rather than `useId()` output: only one Screen
                             * Options renders per editor, so a fixed id can't
                             * collide, and an explicit `htmlFor` pairing beats
                             * label-wrapping for assistive tech that reads the
                             * control before its container.
                             */}
                            {panels.map((panel) => (
                                <label
                                    key={panel.id}
                                    htmlFor={`screen-option-${panel.id}`}
                                    className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-base-content/85 max-lg:min-h-11 hover:bg-base-200/60"
                                >
                                    <input
                                        id={`screen-option-${panel.id}`}
                                        type="checkbox"
                                        checked={!hidden.includes(panel.id)}
                                        onChange={() => onToggle(panel.id)}
                                        className="h-4 w-4 rounded border-base-300 accent-primary"
                                    />
                                    {panel.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <div className="mt-3 border-t border-base-300/60 pt-2">
                        {/*
                         * `type="button"` on both controls here matters: the
                         * whole header sits inside the edit `<form>`, and a
                         * default `type="submit"` would save the record on
                         * every Screen Options click.
                         */}
                        <button
                            id="screen-options-reset"
                            type="button"
                            // Reset rebuilds the whole layout underneath the
                            // dropdown, so leaving it open would leave focus
                            // on a control describing a state that no longer
                            // exists. Close and hand focus back to the
                            // trigger, matching the Escape path (#193).
                            onClick={() => {
                                setOpen(false);
                                triggerRef.current?.focus();
                                onReset();
                            }}
                            className="inline-flex items-center rounded-md text-xs font-semibold text-primary max-lg:min-h-11 hover:underline focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                        >
                            Reset layout
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
