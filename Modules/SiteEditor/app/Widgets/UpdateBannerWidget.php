<?php

declare(strict_types=1);

namespace Modules\SiteEditor\Widgets;

use ArtisanPackUI\CMSFramework\Modules\Core\Updates\Managers\ApplicationUpdateManager;
use Modules\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface;
use Modules\Users\Models\User;
use Throwable;

/**
 * Banner that surfaces when a newer Keystone release is available.
 *
 * Returns `{ visible: false }` when no update is available — or when the
 * update channel isn't configured / the check throws — and the React
 * renderer skips drawing anything for that load. The widget continues to
 * occupy a row in the persisted layout, so it re-emerges as soon as the
 * next check returns an update.
 *
 * Despite the issue text pointing at `Plugins/UpdateManager`, the data
 * shape called for ("current Keystone version + latest available") is
 * what `ApplicationUpdateManager` exposes; the plugin manager only
 * answers per-plugin updates. The `updater.run` capability is already
 * seeded to admin in `KeystonePermissionsSeeder` and gates this widget
 * in both the catalog and per-instance hydration.
 */
class UpdateBannerWidget implements KeystoneAdminWidgetInterface
{
    /**
     * @return array{title: string, description: string, capability: string}
     */
    public static function getWidgetInfo(): array
    {
        return [
            'title'       => 'Keystone update available',
            'description' => 'Full-width banner surfaced only when a Keystone update is waiting.',
            'capability'  => 'updater.run',
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     *
     * @return array{visible: bool, current_version?: string, latest_version?: string, release_date?: string|null, changelog?: string|null}
     */
    public static function getData(User $user, array $options): array
    {
        try {
            $info = app(ApplicationUpdateManager::class)->checkForUpdate();
        } catch (Throwable) {
            // Missing/unreachable update channel must NOT take down the
            // dashboard — collapse the banner instead.
            return ['visible' => false];
        }

        if (! $info->hasUpdate()) {
            return ['visible' => false];
        }

        return [
            'visible'         => true,
            'current_version' => $info->currentVersion,
            'latest_version'  => $info->latestVersion,
            'release_date'    => $info->releaseDate,
            'changelog'       => $info->changelog,
        ];
    }

    /**
     * @return array{component: string, default_grid_config: array<string, array{rows: int, cols: int}>}
     */
    public static function extendedInfo(): array
    {
        return [
            'component'           => 'UpdateBannerWidget',
            'default_grid_config' => [
                'sm' => ['rows' => 1, 'cols' => 12],
                'md' => ['rows' => 1, 'cols' => 12],
                'lg' => ['rows' => 1, 'cols' => 12],
                'xl' => ['rows' => 1, 'cols' => 12],
            ],
        ];
    }
}
