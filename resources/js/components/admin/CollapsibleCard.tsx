import { useId, useState, type ReactNode } from 'react';

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
 * `<button>` + `aria-expanded`/`aria-controls` disclosure pattern
 * (native `<details>` was tried first but skipped close transitions
 * because the browser flipped its `open` attribute synchronously
 * before the row interpolation could run).
 */
export default function CollapsibleCard({
    title,
    summary,
    defaultOpen = false,
    children,
}: CollapsibleCardProps) {
    const [open, setOpen] = useState(defaultOpen);
    const bodyId = useId();

    return (
        <div className="rounded-xl border border-base-300/60 bg-base-100">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls={bodyId}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset rounded-xl"
            >
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        aria-hidden
                        className={`grid h-5 w-5 place-items-center text-base-content/55 transition-transform duration-150 ${
                            open ? 'rotate-90' : ''
                        }`}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-4 w-4"
                        >
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
                </div>
                {summary && !open && (
                    <span className="truncate text-xs text-base-content/55">
                        {summary}
                    </span>
                )}
            </button>
            <div
                id={bodyId}
                className="collapsible-card__body"
                data-open={open ? 'true' : 'false'}
                aria-hidden={!open}
                inert={!open}
            >
                <div className="collapsible-card__body-inner">
                    <div className="border-t border-base-300/60 px-5 py-5">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
