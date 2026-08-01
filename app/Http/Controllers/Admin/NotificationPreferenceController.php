<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use ArtisanPackUI\CMSFramework\Modules\Notifications\Enums\NotificationType;
use ArtisanPackUI\CMSFramework\Modules\Notifications\Managers\NotificationManager;
use ArtisanPackUI\CMSFramework\Modules\Notifications\Models\NotificationPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Per-user notification preferences. Each authenticated user manages their
 * own in-app + email opt-outs for the registered notification types exposed
 * by `NotificationManager::getRegisteredNotifications()` (filter-driven).
 *
 * Complements `notifications.*` settings in {@see \App\Providers\SettingsServiceProvider}
 * — those gate whether a notification is dispatched at all; this controller
 * lets an individual user mute one that is dispatched.
 */
class NotificationPreferenceController extends Controller
{
    public function __construct(protected NotificationManager $notificationManager) {}

    /**
     * Render the Inertia page at `/admin/notifications/preferences`.
     */
    public function index(Request $request): Response
    {
        return Inertia::render('admin/NotificationPreferences', [
            'preferences' => $this->buildPayload($request->user()),
        ]);
    }

    /**
     * GET `/api/v1/notification-preferences` — list registered notification
     * types alongside the user's current preference rows.
     */
    public function apiIndex(Request $request): JsonResponse
    {
        return response()->json($this->buildPayload($request->user()));
    }

    /**
     * PUT `/api/v1/notification-preferences` — bulk upsert preferences for
     * the authenticated user. Payload entries that don't match a registered
     * notification are silently dropped so the table never accumulates
     * orphaned rows for notifications the app no longer dispatches.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'preferences'                     => ['required', 'array'],
            'preferences.*.notification_type' => ['required', 'string', 'max:191'],
            'preferences.*.is_enabled'        => ['required', 'boolean'],
            'preferences.*.email_enabled'     => ['required', 'boolean'],
        ]);

        $registeredKeys = array_keys($this->notificationManager->getRegisteredNotifications());
        $user           = $request->user();

        $touchedKeys = [];

        foreach ($validated['preferences'] as $preference) {
            if (! in_array($preference['notification_type'], $registeredKeys, true)) {
                continue;
            }

            NotificationPreference::updateOrCreate(
                [
                    'user_id'           => $user->id,
                    'notification_type' => sanitizeText((string) $preference['notification_type']),
                ],
                [
                    'is_enabled'    => (bool) $preference['is_enabled'],
                    'email_enabled' => (bool) $preference['email_enabled'],
                ],
            );

            $touchedKeys[] = (string) $preference['notification_type'];
        }

        // Per-user preferences don't produce a global "prior" value cheap
        // to diff, so we pass touched keys instead — subscribers can
        // re-read the rows for the calling user if they need the values.
        // `userId` is included so a subscriber knows *whose* rows to read
        // without depending on the request context.
        $payload = [
            'panel'  => 'notificationPreferences',
            'userId' => (int) $user->id,
            'diff'   => ['keys' => $touchedKeys],
        ];
        doAction('keystone.admin.settings.notificationPreferences.saved', $payload);
        doAction('keystone.admin.settings.saved', $payload);

        return response()->json($this->buildPayload($user));
    }

    /**
     * DELETE `/api/v1/notification-preferences` — wipe the user's preference
     * rows so the "no preference = enabled" defaults in
     * {@see NotificationManager::filterUsersByPreferences()}
     * apply again.
     */
    public function destroy(Request $request): JsonResponse
    {
        NotificationPreference::where('user_id', $request->user()->id)->delete();

        return response()->json($this->buildPayload($request->user()));
    }

    /**
     * Shape the payload consumed by both the Inertia page and the JSON
     * endpoints. Each entry pairs a registered notification with the user's
     * current opt-in flags (defaults to enabled when no row exists).
     *
     * @return array{types: list<array{
     *     key: string,
     *     title: string,
     *     content: string,
     *     type: string,
     *     send_email: bool,
     *     is_enabled: bool,
     *     email_enabled: bool,
     *     has_preference: bool
     * }>}
     */
    protected function buildPayload(User $user): array
    {
        $registered = $this->notificationManager->getRegisteredNotifications();
        $existing   = $user->notificationPreferences()->get()->keyBy('notification_type');

        $types = collect($registered)
            ->map(function (array $config, string $key) use ($existing): array {
                $preference = $existing->get($key);
                $type       = $config['type'] ?? NotificationType::Info;

                return [
                    'key'            => $key,
                    'title'          => (string) ($config['title'] ?? $key),
                    'content'        => (string) ($config['content'] ?? ''),
                    'type'           => $type instanceof NotificationType ? $type->value : (string) $type,
                    'send_email'     => (bool) ($config['send_email'] ?? false),
                    'is_enabled'     => null === $preference ? true : (bool) $preference->is_enabled,
                    'email_enabled'  => null === $preference ? true : (bool) $preference->email_enabled,
                    'has_preference' => null !== $preference,
                ];
            })
            ->values()
            ->all();

        return ['types' => $types];
    }
}
