/**
 * Notifications REST client.
 *
 * Thin XSRF-aware wrappers around the cms-framework notifications endpoints
 * the admin chrome uses to poll for new notifications, mark them read, and
 * persist "mark all read" across reloads. Mirrors the pattern in
 * {@link ./settingsApi.ts} — Sanctum SPA cookie auth, CSRF cookie primed on
 * first write, errors surfaced via {@link NotificationsApiError}.
 */

import NotificationController from '@/actions/ArtisanPackUI/CMSFramework/Modules/Notifications/Http/Controllers/NotificationController';
import { apiFetch } from '@/lib/admin/apiFetch';
import { finishAdminProgress, startAdminProgress } from '@/lib/admin/progress';
import type { NotificationItem } from '@/types/keystone';

const NOTIFICATIONS_API_SOURCE = 'notificationsApi';

/** Thrown when a notifications request fails. */
export class NotificationsApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'NotificationsApiError';
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
            NOTIFICATIONS_API_SOURCE,
        )
            .then((response) => {
                if (!response.ok) {
                    throw new NotificationsApiError(
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

/** Raw vendor notification shape (`NotificationResource::toArray`). */
interface ApiNotification {
    id: number;
    type: { value: string };
    title: string;
    content: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
    user_data?: { is_read: boolean };
}

/** Transform a vendor notification into the admin shell's `NotificationItem`. */
function toNotificationItem(api: ApiNotification): NotificationItem {
    const metadataKind =
        api.metadata && typeof api.metadata.kind === 'string' ? api.metadata.kind : null;

    return {
        id: api.id,
        title: api.title,
        message: api.content,
        kind: metadataKind ?? api.type.value,
        created_at: api.created_at,
        read: Boolean(api.user_data?.is_read),
    };
}

/**
 * Fetch the authenticated user's most recent notifications. Returns an empty
 * list on 401 (session expired / guest) so the caller's polling loop doesn't
 * blow up the bell badge.
 */
export async function fetchNotifications(limit = 10): Promise<NotificationItem[]> {
    const response = await apiFetch(
        NotificationController.index.url({ query: { limit } }),
        {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        },
        NOTIFICATIONS_API_SOURCE,
    );

    if (response.status === 401) {
        return [];
    }
    if (!response.ok) {
        throw new NotificationsApiError(
            `Failed to fetch notifications (status ${response.status}).`,
            response.status,
        );
    }

    const body = (await response.json()) as { data: ApiNotification[] };
    return body.data.map(toNotificationItem);
}

/**
 * POST to a notifications endpoint with the XSRF header attached. Wraps the
 * request in the admin progress bar so user-triggered actions (mark one /
 * mark all read) get visual feedback while the request is in flight. The
 * background poll uses {@link fetchNotifications}, not this helper, so it
 * stays silent by design.
 */
async function postWithCsrf(url: string): Promise<void> {
    startAdminProgress();
    try {
        await ensureCsrfCookie();
        const token = getXsrfToken();

        const response = await apiFetch(
            url,
            {
                method: 'POST',
                credentials: 'include',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    ...(token ? { 'X-XSRF-TOKEN': token } : {}),
                },
            },
            NOTIFICATIONS_API_SOURCE,
        );

        if (!response.ok) {
            throw new NotificationsApiError(
                `Request failed with status ${response.status}.`,
                response.status,
            );
        }
    } finally {
        finishAdminProgress();
    }
}

/** Mark a single notification as read for the authenticated user. */
export function markNotificationAsRead(id: number): Promise<void> {
    return postWithCsrf(NotificationController.markAsRead.url(id));
}

/** Mark every unread notification for the authenticated user as read. */
export function markAllNotificationsAsRead(): Promise<void> {
    return postWithCsrf(NotificationController.markAllAsRead.url());
}
