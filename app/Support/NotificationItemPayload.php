<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\User;
use ArtisanPackUI\CMSFramework\Modules\Notifications\Managers\NotificationManager;
use ArtisanPackUI\CMSFramework\Modules\Notifications\Models\Notification;

/**
 * Builds the `NotificationItem` array shape the admin shell's React side
 * consumes. Shared by {@see \App\Http\Middleware\HandleInertiaRequests}
 * (which surfaces the 10 most recent notifications on every page for the
 * bell dropdown) and the `/admin/notifications` page controller (which
 * surfaces the full list for filtering + grouping).
 *
 * `kind` prefers `metadata.kind` (a domain category set by the dispatcher,
 * e.g. `order`, `lead`) when present and a string; otherwise it falls back
 * to the vendor `NotificationType` enum value (`error`/`warning`/`success`/
 * `info`).
 */
final class NotificationItemPayload
{
    /**
     * Build the payload for an authenticated user. Returns an empty list for
     * guests so callers don't have to null-check before sharing the prop.
     *
     * @return list<array{id: int, title: string, message: string, kind: string, created_at: string, read: bool}>
     */
    public static function forUser(?User $user, int $limit = 10): array
    {
        if (null === $user) {
            return [];
        }

        return app(NotificationManager::class)
            ->getUserNotifications($user->id, limit: $limit)
            ->map(fn (Notification $notification): array => [
                'id'         => $notification->id,
                'title'      => $notification->title,
                'message'    => $notification->content,
                'kind'       => is_array($notification->metadata) && is_string($notification->metadata['kind'] ?? null)
                    ? $notification->metadata['kind']
                    : $notification->type->value,
                'created_at' => $notification->created_at->toISOString(),
                'read'       => (bool) ($notification->pivot?->is_read ?? false),
            ])
            ->values()
            ->all();
    }
}
