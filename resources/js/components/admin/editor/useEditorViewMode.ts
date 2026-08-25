import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
    DEFAULT_EDITOR_VIEW_MODE,
    nextEditorViewMode,
    setAdminChromeMode,
    type EditorViewMode,
} from '@/lib/admin/editorChrome';
import { saveEditorViewMode } from '@/lib/admin/editorPreferencesApi';

/**
 * Keyboard shortcut that cycles the view mode. Carries Alt+Shift so it never
 * collides with typing — the handler fires even while focus is inside the
 * visual editor, unlike the layout's bare-key bindings which skip editable
 * targets. Surfaced to assistive tech via `aria-keyshortcuts` on the switcher.
 */
export const VIEW_MODE_CYCLE_SHORTCUT = 'Alt+Shift+M';

export interface UseEditorViewModeOptions {
    /** Admin resource slug — `posts`, `pages`, or a content-type slug. */
    postType: string;
    /** Mode hydrated from `editorPreferences.view_mode`. */
    initialMode: EditorViewMode;
    /**
     * Whether the visual editor is actually present on this screen. When
     * false the modes don't apply: the mode is pinned to `normal`, the
     * switcher isn't rendered, and the chrome is never hidden.
     */
    enabled: boolean;
    /**
     * Whether this screen has a right settings sidebar that distraction-free
     * turns into a slide-over. False for the content-type editor, which is
     * single-column — there is no panel to slide over.
     */
    hasSettingsPanel: boolean;
}

export interface UseEditorViewModeResult {
    /** The active mode (always `normal` when `enabled` is false). */
    mode: EditorViewMode;
    /** Switch to a specific mode and persist it. */
    setMode: (mode: EditorViewMode) => void;
    /** Advance one step through the mode cycle. */
    cycle: () => void;
    /** Drop from distraction-free back to the mode it was entered from. */
    exitDistractionFree: () => void;
    /** Whether the distraction-free settings slide-over is open. */
    settingsOpen: boolean;
    openSettings: () => void;
    closeSettings: () => void;
    /** Mirrors the option, so consumers render the drawer conditionally. */
    hasSettingsPanel: boolean;
    /**
     * Attach to the header switcher's active button: focus returns here when
     * leaving distraction-free (the header remounts).
     */
    switcherButtonRef: RefObject<HTMLButtonElement | null>;
    /**
     * Attach to the floating control's active button: focus moves here on
     * entering distraction-free (the header — and its switcher — is hidden).
     */
    floatingButtonRef: RefObject<HTMLButtonElement | null>;
}

/**
 * Owns the editor chrome view mode for one edit screen (issue #239): its
 * state, server persistence, the admin-chrome bridge, keyboard shortcuts,
 * the distraction-free settings drawer, and focus management across the
 * transitions that hide or restore chrome.
 *
 * Shared by the post, page, and content-type editors so the three shells
 * behave identically and persist through the same `user_editor_preferences`
 * store — the content-type editor can't use `useEditorLayout` (it has no
 * panel sidebar), so the mode lives in its own hook rather than inside that
 * one.
 *
 * Persistence is optimistic and best-effort, matching `useEditorLayout`: a
 * switch updates the UI immediately and a failed write is swallowed rather
 * than rolled back.
 */
export function useEditorViewMode({
    postType,
    initialMode,
    enabled,
    hasSettingsPanel,
}: UseEditorViewModeOptions): UseEditorViewModeResult {
    const [mode, setModeState] = useState<EditorViewMode>(
        enabled ? initialMode : DEFAULT_EDITOR_VIEW_MODE,
    );
    const [settingsOpen, setSettingsOpen] = useState(false);

    const switcherButtonRef = useRef<HTMLButtonElement | null>(null);
    const floatingButtonRef = useRef<HTMLButtonElement | null>(null);

    // The mode distraction-free was entered from, so Esc restores it rather
    // than always dropping to Normal.
    const beforeDistractionFreeRef = useRef<EditorViewMode>(DEFAULT_EDITOR_VIEW_MODE);
    const abortRef = useRef<AbortController | null>(null);

    // Mirror `settingsOpen` so the keydown handler can read it without being
    // re-registered on every drawer toggle.
    const settingsOpenRef = useRef(settingsOpen);
    useEffect(() => {
        settingsOpenRef.current = settingsOpen;
    }, [settingsOpen]);

    const persist = useCallback(
        (next: EditorViewMode): void => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            void saveEditorViewMode(postType, next, controller.signal).catch(() => {});
        },
        [postType],
    );

    // Side effects (persist, closing the drawer, recording the pre-DF mode)
    // run here rather than inside a `setState` updater so the updater stays
    // pure — React may run it twice, which would double-fire the write.
    const setMode = useCallback(
        (next: EditorViewMode): void => {
            if (!enabled || next === mode) {
                return;
            }
            if (next === 'distraction-free') {
                beforeDistractionFreeRef.current = mode;
            } else {
                // Leaving distraction-free closes the slide-over — it has no
                // meaning outside that mode.
                setSettingsOpen(false);
            }
            setModeState(next);
            persist(next);
        },
        [enabled, mode, persist],
    );

    const cycle = useCallback((): void => {
        setMode(nextEditorViewMode(mode));
    }, [mode, setMode]);

    const exitDistractionFree = useCallback((): void => {
        if (mode !== 'distraction-free') {
            return;
        }
        setMode(beforeDistractionFreeRef.current);
    }, [mode, setMode]);

    const openSettings = useCallback((): void => setSettingsOpen(true), []);
    const closeSettings = useCallback((): void => setSettingsOpen(false), []);

    // ---------------------------------------------------------------
    // Admin-chrome bridge
    // ---------------------------------------------------------------

    // Push the effective mode to the shared store the layout reads. Reset to
    // `normal` on unmount so navigating away from a hidden-chrome editor
    // doesn't leave the next page's sidebar/topbar hidden.
    useEffect(() => {
        setAdminChromeMode(enabled ? mode : DEFAULT_EDITOR_VIEW_MODE);
    }, [enabled, mode]);

    useEffect(() => () => setAdminChromeMode(DEFAULT_EDITOR_VIEW_MODE), []);

    // ---------------------------------------------------------------
    // Keyboard
    // ---------------------------------------------------------------

    useEffect(() => {
        if (!enabled) {
            return;
        }

        function onKey(event: KeyboardEvent): void {
            // Alt+Shift+M cycles. `event.code` (not `key`) so the physical M
            // matches regardless of the character Alt produces on some
            // layouts.
            if (event.altKey && event.shiftKey && event.code === 'KeyM') {
                event.preventDefault();
                cycle();
                return;
            }

            if (event.key === 'Escape') {
                // In distraction-free, Esc closes the settings slide-over
                // first, then exits the mode — one Esc per layer, so it never
                // yanks the user out of the mode while a panel they opened is
                // still up. Handled on `keydown` without `preventDefault` so
                // the visual editor's own Esc handling (closing a block menu)
                // is not stolen when neither layer is open.
                if (settingsOpenRef.current) {
                    setSettingsOpen(false);
                } else {
                    exitDistractionFree();
                }
            }
        }

        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [enabled, cycle, exitDistractionFree]);

    // ---------------------------------------------------------------
    // Focus management
    // ---------------------------------------------------------------

    // Move focus deliberately across the transitions that add or remove
    // chrome so it is never stranded on an unmounted control:
    //  - entering distraction-free hides the header (and its switcher) →
    //    focus the floating control.
    //  - leaving distraction-free remounts the header → focus its switcher.
    // Skipped on the initial mount (nothing to move focus from yet).
    const prevModeRef = useRef(mode);
    const mountedRef = useRef(false);

    useEffect(() => {
        const previous = prevModeRef.current;
        prevModeRef.current = mode;

        if (!mountedRef.current) {
            mountedRef.current = true;
            return;
        }

        const enteredDistractionFree =
            previous !== 'distraction-free' && mode === 'distraction-free';
        const leftDistractionFree =
            previous === 'distraction-free' && mode !== 'distraction-free';

        if (!enteredDistractionFree && !leftDistractionFree) {
            return;
        }

        // The target mounts in this same commit; defer a frame so the ref is
        // populated before we focus it.
        const target = enteredDistractionFree ? floatingButtonRef : switcherButtonRef;
        const raf = requestAnimationFrame(() => target.current?.focus());
        return () => cancelAnimationFrame(raf);
    }, [mode]);

    return {
        mode: enabled ? mode : DEFAULT_EDITOR_VIEW_MODE,
        setMode,
        cycle,
        exitDistractionFree,
        settingsOpen,
        openSettings,
        closeSettings,
        hasSettingsPanel,
        switcherButtonRef,
        floatingButtonRef,
    };
}
