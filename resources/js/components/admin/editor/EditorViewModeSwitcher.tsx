import { type ReactNode, type Ref } from 'react';
import {
    EDITOR_VIEW_MODES,
    EDITOR_VIEW_MODE_LABELS,
    type EditorViewMode,
} from '@/lib/admin/editorChrome';
import { VIEW_MODE_CYCLE_SHORTCUT } from '@/components/admin/editor/useEditorViewMode';

/** A small glyph per mode, hinting at how much chrome each one keeps. */
const MODE_ICONS: Record<EditorViewMode, ReactNode> = {
    'normal': (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-3.5 w-3.5">
            <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M15 4v16" stroke="currentColor" strokeWidth="2" />
        </svg>
    ),
    'full-width': (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-3.5 w-3.5">
            <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M7 3v18M17 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    'distraction-free': (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-3.5 w-3.5">
            <path
                d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    ),
};

export interface EditorViewModeSwitcherProps {
    /** The active mode. */
    mode: EditorViewMode;
    /** Switch to a mode. */
    onChange: (mode: EditorViewMode) => void;
    /**
     * Attached to the currently-active button so a parent can restore focus
     * here (see `useEditorViewMode`'s focus management).
     */
    activeButtonRef?: Ref<HTMLButtonElement>;
    /** Extra classes for the group container. */
    className?: string;
}

/**
 * Three-way editor chrome switcher (issue #239): Normal / Full-width /
 * Distraction-free.
 *
 * A segmented `role="group"` of toggle buttons. The active option carries
 * `aria-pressed="true"` so assistive tech reads the current selection, and
 * every button has a text label plus an icon. `aria-keyshortcuts` advertises
 * the Alt+Shift+M cycle shortcut the hook registers.
 *
 * `type="button"` on every control: the post/page editors render this inside
 * the edit `<form>`, and a default submit type would save the record on each
 * mode switch.
 */
export default function EditorViewModeSwitcher({
    mode,
    onChange,
    activeButtonRef,
    className = '',
}: EditorViewModeSwitcherProps) {
    return (
        <div
            role="group"
            aria-label="Editor view mode"
            className={`inline-flex items-center rounded-lg border border-base-300/60 bg-base-100 p-0.5 ${className}`}
        >
            {EDITOR_VIEW_MODES.map((option) => {
                const active = option === mode;
                const label = EDITOR_VIEW_MODE_LABELS[option];

                return (
                    <button
                        key={option}
                        ref={active ? activeButtonRef : undefined}
                        type="button"
                        data-view-mode={option}
                        aria-pressed={active}
                        // On the active button only — a single focusable
                        // control that represents the switcher's current
                        // state — so AT announces the cycle shortcut once
                        // rather than on every mode button.
                        aria-keyshortcuts={active ? VIEW_MODE_CYCLE_SHORTCUT : undefined}
                        title={`${label} view`}
                        onClick={() => onChange(option)}
                        className={[
                            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors max-lg:min-h-11',
                            'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                            active
                                ? 'bg-primary text-primary-content shadow-sm'
                                : 'text-base-content/70 hover:bg-base-200',
                        ].join(' ')}
                    >
                        {MODE_ICONS[option]}
                        <span className="max-sm:sr-only">{label}</span>
                    </button>
                );
            })}
        </div>
    );
}
