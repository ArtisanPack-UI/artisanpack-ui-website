/**
 * Settings REST client.
 *
 * Thin XSRF-aware wrappers around the cms-framework settings endpoints used
 * by the admin Settings page:
 *
 * - `saveSiteSettings`     → `PUT /api/v1/settings/site` (WP-shape `site.*`).
 * - `saveRegisteredSettings` → `PUT /api/v1/settings` (manager-routed bulk
 *   save; each value runs through its registered sanitizer + type).
 *
 * Both rely on Sanctum SPA cookie auth, mirroring the media library client.
 */

import { apiFetch } from '@/lib/admin/apiFetch';
import { finishAdminProgress, startAdminProgress } from '@/lib/admin/progress';

const SETTINGS_API_SOURCE = 'settingsApi';

/** A `{ field: [messages] }` validation bag from a 422 response. */
export type ValidationErrors = Record<string, string[]>;

/**
 * Thrown when a save fails. Carries the parsed validation bag (if any) so
 * panels can surface per-field errors.
 */
export class SettingsApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly errors: ValidationErrors = {},
    ) {
        super(message);
        this.name = 'SettingsApiError';
    }
}

/** Read the Sanctum XSRF token from cookies. */
function getXsrfToken(): string | null {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

let csrfPromise: Promise<void> | null = null;

/**
 * Ensure the Sanctum CSRF cookie is set before an authenticated write.
 * Concurrent callers share one in-flight request; the promise is cleared once
 * it settles so an expired cookie is re-fetched on a later call rather than
 * staying permanently locked to the first (long-resolved) request.
 */
async function ensureCsrfCookie(): Promise<void> {
    if (getXsrfToken()) {
        return;
    }
    if (!csrfPromise) {
        csrfPromise = apiFetch(
            '/sanctum/csrf-cookie',
            { method: 'GET', credentials: 'include' },
            SETTINGS_API_SOURCE,
        )
            .then((response) => {
                if (!response.ok) {
                    throw new SettingsApiError(
                        `Failed to initialize CSRF cookie (status ${response.status}).`,
                        response.status,
                    );
                }
            })
            .finally(() => {
                csrfPromise = null;
            });
    }
    await csrfPromise;
}

/**
 * PUT JSON to a settings endpoint, parsing validation errors on failure.
 * Wraps the request in the admin progress bar so the Settings "Save" button
 * gets visual feedback while the request is in flight.
 */
async function putJson<T>(url: string, body: unknown): Promise<T> {
    startAdminProgress();
    try {
        await ensureCsrfCookie();

        const token = getXsrfToken();
        const response = await apiFetch(
            url,
            {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    ...(token ? { 'X-XSRF-TOKEN': token } : {}),
                },
                body: JSON.stringify(body),
            },
            SETTINGS_API_SOURCE,
        );

        if (!response.ok) {
            let message = `Request failed with status ${response.status}`;
            let errors: ValidationErrors = {};
            try {
                const data = await response.json();
                message = data.message ?? message;
                errors = data.errors ?? {};
            } catch {
                // Non-JSON error body; fall back to the status message.
            }
            throw new SettingsApiError(message, response.status, errors);
        }

        return response.json() as Promise<T>;
    } finally {
        finishAdminProgress();
    }
}

/** WP-shape payload accepted by the site-meta endpoint (all fields optional). */
export interface SiteSettingsPayload {
    title?: string;
    description?: string;
    url?: string;
    site_logo?: number | null;
    site_icon?: number | null;
}

/** Save the universal `site.*` settings through the framework façade. */
export function saveSiteSettings(
    payload: SiteSettingsPayload,
): Promise<{ settings: Record<string, unknown> }> {
    return putJson('/api/v1/settings/site', payload);
}

/**
 * Save registered settings by dotted key through the manager-routed bulk
 * endpoint (sanitizers + types applied). Keys must be registered server-side.
 */
export function saveRegisteredSettings(
    settings: Record<string, unknown>,
): Promise<{ settings: Record<string, unknown> }> {
    return putJson('/api/v1/settings', { settings });
}
