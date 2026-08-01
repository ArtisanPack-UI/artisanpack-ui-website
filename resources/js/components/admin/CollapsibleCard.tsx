import { useId, useState, type ReactNode } from 'react';
import {
    EditorPanelChromeProvider,
    useEditorPanelChrome,
} from '@/components/admin/editor/panelChrome';

interface CollapsibleCardProps {
    title: string;
    /** One-line preview shown on the collapsed header (e.g. "parent · template"). */
    summary?: string;
    /** Open on first render. Defaults to `false`. */
    defaultOpen?: boolean;
    children: ReactNode;
}

/**
 * Card with a collapsible body that animates open/close via the
 * grid-template-rows `0fr` → `1fr` interpolation pattern. Uses a
 * heading-wrapped `<button>` + `aria-expanded`/`aria-controls` disclosure pattern
 * (native `<details>` was tried first but skipped close transitions
 * because the browser flipped its `open` attribute synchronously
 * before the row interpolation could run).
 *
 * Inside the editor's sortable columns the card also picks up reorder
 * chrome from context (issue #190): the header grows a drag handle and a
 * `⋮` menu, and open/closed becomes controlled so it persists per-user,
 * per-post-type. Everywhere else — the Dynamic Content editor, for
 * instance — no chrome is provided and the card behaves exactly as before,
 * owning its own open state and honouring `defaultOpen`.
 */
export default function CollapsibleCard({
    title,
    summary,
    defaultOpen = false,
    children,
}: CollapsibleCardProps) {
    const chrome = useEditorPanelChrome();
    const [localOpen, setLocalOpen] = useState(defaultOpen);
    const bodyId = useId();

    const controlled = null !== chrome && chrome.collapsible;
    const open = controlled ? !chrome.collapsed : localOpen;

    function toggle() {
        if (controlled) {
            chrome.setCollapsed(open);
            return;
        }
        setLocalOpen((v) => !v);
    }

    return (
        <div className="rounded-xl border border-base-300/60 bg-base-100">
            {/*
             * The header is a row rather than one full-width button because
             * the drag handle and `⋮` menu are themselves interactive —
             * nesting them inside the disclosure button would be invalid
             * HTML and unreachable by keyboard.
             *
             * The ⌘-arrow reorder shortcuts bind here rather than on the
             * card root so they don't swallow ⌘-arrow inside the panel's
             * own text inputs.
             */}
            <div className="flex items-center gap-1 pr-3" onKeyDown={chrome?.onHeaderKeyDown}>
                {/*
                 * The disclosure button is wrapped in a real heading (#193):
                 * a panel label that is only a styled `<span>` never appears
                 * in a screen reader's heading list, so "jump to Categories"
                 * — the fastest way around a long editor — doesn't work. The
                 * heading carries no styling of its own; the button inside
                 * keeps every visual it had.
                 */}
                <h2 className="flex min-w-0 flex-1">
                    <button
                        type="button"
                        onClick={toggle}
                        aria-expanded={open}
                        aria-controls={bodyId}
                        className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 rounded-xl px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset"
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <span
                                aria-hidden
                                className={`grid h-5 w-5 place-items-center text-base-content/60 transition-transform duration-150 ${
                                    open ? 'rotate-90' : ''
                                }`}
                            >
                                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                                    <path
                                        d="M9 6l6 6-6 6"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </span>
                            <span className="font-display text-sm font-semibold tracking-wide uppercase text-base-content/85">
                                {title}
                            </span>
                        </span>
                        {summary && !open && (
                            <span className="truncate text-xs text-base-content/70">{summary}</span>
                        )}
                    </button>
                </h2>
                {chrome?.controls}
            </div>
            <div
                id={bodyId}
                className="collapsible-card__body"
                data-open={open ? 'true' : 'false'}
                aria-hidden={!open}
                inert={!open}
            >
                <div className="collapsible-card__body-inner">
                    <div className="border-t border-base-300/60 px-5 py-5">
                        {/*
                         * Chrome is consumed here: a `CollapsibleCard`
                         * nested inside a panel body would otherwise grow a
                         * second drag handle that reorders its parent.
                         */}
                        {chrome ? (
                            <EditorPanelChromeProvider value={null}>
                                {children}
                            </EditorPanelChromeProvider>
                        ) : (
                            children
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
