<?php

declare(strict_types=1);

namespace Modules\Updater\Services;

use ArtisanPackUI\CMSFramework\Modules\Notifications\Enums\NotificationType;
use ArtisanPackUI\CMSFramework\Modules\Notifications\Managers\NotificationManager;
use ArtisanPackUI\CMSFramework\Modules\Users\Models\Role;

/**
 * Fans out update-related notifications to every admin on the install.
 *
 * The cms-framework Updates module surfaces success / failure only via
 * the command's return value — it does not emit Notifications by itself.
 * This service is the bridge that issue #21 wires in: the Settings >
 * System > Updates controller calls one of `notifySuccess()` /
 * `notifyFailure()` after running the manager, and every user with the
 * admin role receives an in-app notification.
 *
 * Lookup is by role *slug* (not role name) because the cms-framework's
 * `NotificationManager::sendNotificationByRole()` matches against the
 * `name` column, which is not what `KeystoneRolesSeeder` populates as
 * the canonical role identifier.
 */
class UpdateNotifier
{
    public function __construct(private readonly NotificationManager $notifications) {}

    public function notifySuccess(string $version): void
    {
        $this->fanout(
            key: 'keystone.update.success',
            title: 'Keystone updated to '.$version,
            content: 'Update applied cleanly. Verify the dashboard and content surface look right.',
            type: NotificationType::Success,
            metadata: ['kind' => 'update', 'version' => $version, 'status' => 'success'],
        );
    }

    public function notifyFailure(string $targetVersion, string $errorMessage): void
    {
        $this->fanout(
            key: 'keystone.update.failure',
            title: 'Keystone update to '.$targetVersion.' failed',
            content: 'The snapshot was restored. Details: '.$errorMessage,
            type: NotificationType::Error,
            metadata: [
                'kind'    => 'update',
                'version' => $targetVersion,
                'status'  => 'failure',
                'error'   => $errorMessage,
            ],
        );
    }

    /**
     * Resolve the list of admin user ids to notify.
     *
     * Public so tests and callers can sanity-check the audience without
     * sending. Returns the empty list when no admin role exists yet
     * (e.g. before seeders have run).
     *
     * @return array<int, int>
     */
    public function adminRecipients(): array
    {
        $slug = (string) config('keystone.admin_role', 'admin');
        $role = Role::query()->where('slug', $slug)->first();

        if (null === $role) {
            return [];
        }

        return $role->users()->pluck('users.id')->all();
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function fanout(
        string $key,
        string $title,
        string $content,
        NotificationType $type,
        array $metadata,
    ): void {
        $recipients = $this->adminRecipients();

        if ([] === $recipients) {
            return;
        }

        $this->notifications->sendNotification(
            key: $key,
            userIds: $recipients,
            overrides: [
                'title'    => $title,
                'content'  => $content,
                'type'     => $type,
                'metadata' => $metadata,
            ],
        );
    }
}
