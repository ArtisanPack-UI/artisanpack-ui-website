<?php

declare(strict_types=1);

namespace App\SiteEditor\Widgets\Contracts;

use App\Models\User;
use ArtisanPackUI\CMSFramework\Modules\AdminWidgets\Contracts\AdminWidgetInterface;

/**
 * Keystone-specific extension of the framework's AdminWidgetInterface.
 *
 * Adds two server-side concerns the framework contract leaves open:
 *  - `getData()` resolves the per-request payload the React component renders.
 *    The `DashboardController` calls this for every instance on every load,
 *    so implementations should be cheap (or memoize themselves).
 *  - `extendedInfo()` carries the stable React `component` key and an
 *    optional JSON-schema-ish `settings_schema` consumed by the widget
 *    settings modal (separate sub-issue). It is merged into `getWidgetInfo()`
 *    when the controller hands `available_widgets` to the frontend.
 */
interface KeystoneAdminWidgetInterface extends AdminWidgetInterface
{
    /**
     * Resolve the widget's per-request payload for $user.
     *
     * @param  array<string, mixed>  $options  The instance's stored options (from the dashboard JSON).
     *
     * @return array<string, mixed>
     */
    public static function getData(User $user, array $options): array;

    /**
     * Extra static metadata merged into `getWidgetInfo()` on the available-widgets payload.
     *
     * @return array{component: string, settings_schema?: array<string, mixed>}
     */
    public static function extendedInfo(): array;
}
