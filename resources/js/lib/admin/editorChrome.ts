import { useSyncExternalStore } from 'react';

/**
 * Editor chrome view modes (issue #239).
 *
 * Mirror of `App\Support\ContentEdit\EditorViewModes` — these strings are the
 * values persisted in `user_editor_preferences.view_mode`, so the two must
 * stay in sync.
 *
 * - **normal** — today's layout inside the full admin chrome.
 * - **full-width** — the left admin sidebar is hidden so the editor column
 *   expands; topbar and the right settings sidebar remain.
 * - **distraction-free** — admin sidebar and topbar are both hidden and the
 *   visual editor fills the screen.
 */
export type EditorViewMode = 'normal' | 'full-width' | 'distraction-free';

/** Every selectable mode, in cycle order. The switcher renders them so. */
export const EDITOR_VIEW_MODES: readonly EditorViewMode[] = [
    'normal',
    'full-width',
    'distraction-free',
] as const;

/** The mode a first-time editor gets, and the SSR / reset value. */
export const DEFAULT_EDITOR_VIEW_MODE: EditorViewMode = 'normal';

/** Human labels for the switcher, floating control, and announcements. */
export const EDITOR_VIEW_MODE_LABELS: Record<EditorViewMode, string> = {
    'normal': 'Normal',
    'full-width': 'Full width',
    'distraction-free': 'Distraction-free',
};

export function isEditorViewMode(value: unknown): value is EditorViewMode {
    return (
        typeof value === 'string' && (EDITOR_VIEW_MODES as readonly string[]).includes(value)
    );
}

/** Map anything unrecognised back to the default, matching the server. */
export function normalizeEditorViewMode(value: unknown): EditorViewMode {
    return isEditorViewMode(value) ? value : DEFAULT_EDITOR_VIEW_MODE;
}

/** Next mode in the cycle Normal → Full-width → Distraction-free → Normal. */
export function nextEditorViewMode(mode: EditorViewMode): EditorViewMode {
    const index = EDITOR_VIEW_MODES.indexOf(mode);
    return EDITOR_VIEW_MODES[(index + 1) % EDITOR_VIEW_MODES.length];
}

// ---------------------------------------------------------------------------
// Chrome store
// ---------------------------------------------------------------------------

/**
 * The editor page sets the mode; `KeystoneAdminLayout` — the page's ancestor —
 * reads it to hide the admin sidebar and topbar. They cannot share React state
 * directly because the layout renders the page as opaque `children`, so this
 * tiny external store bridges them.
 *
 * The store is module-global and survives Inertia visits (the document stays
 * alive), which is exactly why {@link useEditorViewMode} resets it to `normal`
 * when an editor unmounts — otherwise navigating away from a distraction-free
 * editor would leave the next page's chrome hidden.
 */
let chromeMode: EditorViewMode = DEFAULT_EDITOR_VIEW_MODE;
const listeners = new Set<() => void>();

export function getAdminChromeMode(): EditorViewMode {
    return chromeMode;
}

export function setAdminChromeMode(mode: EditorViewMode): void {
    const next = normalizeEditorViewMode(mode);
    if (next === chromeMode) {
        return;
    }
    chromeMode = next;
    for (const listener of listeners) {
        listener();
    }
}

function subscribe(callback: () => void): () => void {
    listeners.add(callback);
    return () => {
        listeners.delete(callback);
    };
}

// Always `normal` on the server: SSR renders the full chrome, and the client
// starts there too (module init), so hydration matches. The editor's effect
// flips the store to the stored mode after mount, avoiding a mismatch.
function getServerSnapshot(): EditorViewMode {
    return DEFAULT_EDITOR_VIEW_MODE;
}

/** Subscribe a component (the admin layout) to the current chrome mode. */
export function useAdminChromeMode(): EditorViewMode {
    return useSyncExternalStore(subscribe, getAdminChromeMode, getServerSnapshot);
}
