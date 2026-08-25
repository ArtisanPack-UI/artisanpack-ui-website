/**
 * Editor layout preferences REST client (issues #189, #190).
 *
 * Backs the Screen Options dropdown and the panel drag / keyboard reorder
 * controls on the post / page edit screens.
 * Unlike {@link ./notificationPreferencesApi.ts} these endpoints live on
 * the session-authenticated `/admin` routes rather than the Sanctum
 * `/api/v1` group, so there is no CSRF-cookie priming step — the admin
 * shell already holds the `XSRF-TOKEN` cookie by the time an editor
 * renders.
 *
 * Writes deliberately go through `fetch` rather than an Inertia visit:
 * the edit screen holds unsaved form state and a dirty-tracking baseline,
 * and a partial reload would be a needless chance to disturb both for a
 * preference that never affects the submitted payload.
 */

import { apiFetch } from '@/lib/admin/apiFetch';
import type { EditorViewMode } from '@/lib/admin/editorChrome';
import { destroy, update, viewMode } from '@/routes/admin/editor-preferences';

const EDITOR_PREFERENCES_API_SOURCE = 'editorPreferencesApi';

/**
 * Saved panel placement, one list per editor column. `main` is the writing
 * column (below the pinned title and block editor); `sidebar` is the
 * metadata column.
 *
 * Either list may omit panels the user has never moved — the client
 * appends the unplaced ones to `sidebar` in shipped order, so an empty
 * `panel_order` resolves to the default layout.
 */
export interface EditorPanelOrder {
    main: string[];
    sidebar: string[];
}

/**
 * Payload shape returned by every editor-preferences endpoint, and the
 * shape the edit screens hydrate from.
 *
 * Single source of truth for the producer/consumer contract with
 * `UserEditorPreference::payloadFor()` — the Inertia page props import
 * this rather than redeclaring it, so a change to the saved layout shape
 * updates every consumer at once.
 */
export interface EditorPreferencesPayload {
    post_type: string;
    hidden_panels: string[];
    collapsed_panels: string[];
    panel_order: EditorPanelOrder;
    /** Editor chrome view mode (issue #239). */
    view_mode: EditorViewMode;
}

/** The layout state a write replaces wholesale. */
export interface EditorLayoutInput {
    hidden_panels: string[];
    collapsed_panels: string[];
    panel_order: EditorPanelOrder;
}

/** Thrown when a preferences request completes with a non-2xx status. */
export class EditorPreferencesApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'EditorPreferencesApiError';
    }
}

/**
 * Read the XSRF token the admin session cookie carries.
 *
 * The name is anchored to a cookie boundary so an unrelated cookie whose
 * name merely *ends* in `XSRF-TOKEN` can't be matched first and send the
 * wrong token. The sibling `lib/admin/*Api.ts` clients still carry the
 * older unanchored form; consolidating them onto one shared helper is
 * left as its own change rather than widened into this MR.
 */
function getXsrfToken(): string | null {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
}

async function requestJson(
    method: 'PUT' | 'DELETE',
    url: string,
    body: unknown | undefined,
    signal: AbortSignal | undefined,
): Promise<EditorPreferencesPayload> {
    const token = getXsrfToken();

    const response = await apiFetch(
        url,
        {
            method,
            credentials: 'same-origin',
            ...(signal ? { signal } : {}),
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                ...(token ? { 'X-XSRF-TOKEN': token } : {}),
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        },
        EDITOR_PREFERENCES_API_SOURCE,
    );

    if (!response.ok) {
        throw new EditorPreferencesApiError(
            `Request failed with status ${response.status}.`,
            response.status,
        );
    }

    return response.json() as Promise<EditorPreferencesPayload>;
}

/**
 * Replace the calling user's saved layout for a post type — visibility,
 * collapse state, and column order together. The complete state is sent on
 * every call, so a dropped request self-heals on the next change rather
 * than leaving a half-applied diff.
 */
export function saveEditorLayout(
    postType: string,
    layout: EditorLayoutInput,
    signal?: AbortSignal,
): Promise<EditorPreferencesPayload> {
    return requestJson('PUT', update(postType).url, layout, signal);
}

/**
 * Persist only the editor chrome view mode for a post type (issue #239).
 *
 * Its own endpoint rather than a key on {@link saveEditorLayout} so a mode
 * switch never has to carry — or clobber — the panel layout, and so the
 * content-type editor (which has no panel layout) can persist through the
 * same store. The panel columns on the row are left untouched.
 */
export function saveEditorViewMode(
    postType: string,
    mode: EditorViewMode,
    signal?: AbortSignal,
): Promise<EditorPreferencesPayload> {
    return requestJson('PUT', viewMode(postType).url, { view_mode: mode }, signal);
}

/** Clear the user's saved layout for a post type ("Reset layout"). */
export function resetEditorPreferences(
    postType: string,
    signal?: AbortSignal,
): Promise<EditorPreferencesPayload> {
    return requestJson('DELETE', destroy(postType).url, undefined, signal);
}
