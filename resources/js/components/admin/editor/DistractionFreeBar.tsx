import EditorViewModeSwitcher from '@/components/admin/editor/EditorViewModeSwitcher';
import { type EditorViewMode } from '@/lib/admin/editorChrome';
import { type UseEditorViewModeResult } from '@/components/admin/editor/useEditorViewMode';

export interface DistractionFreeBarProps {
    /** The active mode — the bar renders only while this is distraction-free. */
    mode: EditorViewMode;
    /** Switch modes (also how the user exits distraction-free). */
    onChange: (mode: EditorViewMode) => void;
    /** Whether the settings slide-over is currently open. */
    settingsOpen: boolean;
    /** Open the settings slide-over. Omit when the screen has no settings panel. */
    onOpenSettings?: () => void;
    /** Focus target for the hook when entering distraction-free. */
    floatingButtonRef: UseEditorViewModeResult['floatingButtonRef'];
}

/**
 * The floating control shown in distraction-free mode (issue #239).
 *
 * Distraction-free hides the editor header — and with it the inline
 * switcher — so this pinned control is how the user switches modes, exits, or
 * (on screens that have one) reveals the settings slide-over.
 *
 * It is always in the DOM and always keyboard-reachable in tab order — the
 * hover reveal only changes its opacity, never whether it exists — so it
 * meets the "not hover-only" accessibility bar. Opacity transitions carry
 * `motion-reduce:transition-none` so a reduced-motion user gets an instant
 * state change.
 */
export default function DistractionFreeBar({
    mode,
    onChange,
    settingsOpen,
    onOpenSettings,
    floatingButtonRef,
}: DistractionFreeBarProps) {
    if (mode !== 'distraction-free') {
        return null;
    }

    return (
        <div
            role="group"
            aria-label="Distraction-free controls"
            data-distraction-free-bar
            // Full element opacity so the 12px labels keep their 4.5:1
            // contrast; the recede comes from the translucent surface
            // (`bg-base-100/95`) alone, never a dim applied to the text.
            className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-base-300/60 bg-base-100/95 p-1.5 shadow-xl backdrop-blur"
        >
            <EditorViewModeSwitcher
                mode={mode}
                onChange={onChange}
                activeButtonRef={floatingButtonRef}
                className="border-0 bg-transparent p-0"
            />

            {onOpenSettings && (
                <button
                    type="button"
                    onClick={onOpenSettings}
                    aria-expanded={settingsOpen}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-2.5 py-1.5 text-xs font-semibold text-base-content/75 max-lg:min-h-11 hover:bg-base-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-3.5 w-3.5">
                        <path
                            d="M4 6h16M4 12h16M4 18h16"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>
                    Settings
                </button>
            )}
        </div>
    );
}
