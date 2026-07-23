/**
 * Notification preferences REST client.
 *
 * Thin XSRF-aware wrappers around `/api/v1/notification-preferences` used by
 * the `/admin/notifications/preferences` page. Mirrors the pattern in
 * {@link ./settingsApi.ts} — Sanctum SPA cookie auth, CSRF cookie primed on
 * first write, errors surfaced via {@link NotificationPreferencesApiError}.
 */

import { finishAdminProgress, startAdminProgress } from '@/lib/admin/progress';

/** A single registered notification type paired with the user's preference. */
export interface NotificationPreferenceType {
    key: string;
    title: string;
    content: string;
    type: string;
    send_email: boolean;
    is_enabled: boolean;
    email_enabled: boolean;
    has_preference: boolean;
}

/** Payload shape returned by every notification-preferences endpoint. */
export interface NotificationPreferencesPayload {
    types: NotificationPreferenceType[];
}

/** Single entry sent on bulk save. */
export interface NotificationPreferenceInput {
    notification_type: string;
    is_enabled: boolean;
    email_enabled: boolean;
}

/** Thrown when a preferences request fails. */
export class NotificationPreferencesApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'NotificationPreferencesApiError';
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
        csrfPromise = fetch('/sanctum/csrf-cookie', { credentials: 'include' })
            .then((response) => {
                if (!response.ok) {
                    throw new NotificationPreferencesApiError(
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

const ENDPOINT = '/api/v1/notification-preferences';

async function requestJson(
    method: 'GET' | 'PUT' | 'DELETE',
    body?: unknown,
): Promise<NotificationPreferencesPayload> {
    // Only writes (Save / Reset button clicks) flash the admin progress bar.
    // GET is used for initial load and could be re-issued in background flows;
    // leaving it silent mirrors the "background poll stays quiet" reasoning in
    // {@link ./notificationsApi.ts}.
    const showProgress = method !== 'GET';
    if (showProgress) {
        startAdminProgress();
    }
    try {
        if (method !== 'GET') {
            await ensureCsrfCookie();
        }
        const token = getXsrfToken();

        const response = await fetch(ENDPOINT, {
            method,
            credentials: 'include',
            headers: {
                Accept: 'application/json',
                ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
                ...(token && method !== 'GET' ? { 'X-XSRF-TOKEN': token } : {}),
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });

        if (!response.ok) {
            throw new NotificationPreferencesApiError(
                `Request failed with status ${response.status}.`,
                response.status,
            );
        }

        return response.json() as Promise<NotificationPreferencesPayload>;
    } finally {
        if (showProgress) {
            finishAdminProgress();
        }
    }
}

/** Fetch the registered notification types + the user's current preferences. */
export function fetchNotificationPreferences(): Promise<NotificationPreferencesPayload> {
    return requestJson('GET');
}

/** Bulk upsert preferences for the authenticated user. */
export function saveNotificationPreferences(
    preferences: NotificationPreferenceInput[],
): Promise<NotificationPreferencesPayload> {
    return requestJson('PUT', { preferences });
}

/** Reset the user's preferences (delete all rows so defaults apply again). */
export function resetNotificationPreferences(): Promise<NotificationPreferencesPayload> {
    return requestJson('DELETE');
}
