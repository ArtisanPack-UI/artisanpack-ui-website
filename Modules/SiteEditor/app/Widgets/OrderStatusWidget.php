<?php

declare(strict_types=1);

namespace Modules\SiteEditor\Widgets;

use Modules\Installer\Support\KeystoneSampleData;
use Modules\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface;
use Modules\Users\Models\User;

/**
 * Bar chart of order-status distribution over the trailing 30 days.
 *
 * Demo-data backed until the commerce admin lands in issue #28.
 */
class OrderStatusWidget implements KeystoneAdminWidgetInterface
{
    /**
     * @return array{title: string, description: string}
     */
    public static function getWidgetInfo(): array
    {
        return [
            'title'       => 'Order status',
            'description' => '30-day distribution across paid, fulfilled, pending, refunded.',
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     *
     * @return array{breakdown: list<array{label: string, value: int}>}
     */
    public static function getData(User $user, array $options): array
    {
        return [
            'breakdown' => KeystoneSampleData::orderStatusBreakdown(),
        ];
    }

    /**
     * @return array{component: string, is_demo: bool}
     */
    public static function extendedInfo(): array
    {
        return [
            'component' => 'OrderStatusWidget',
            'is_demo'   => true,
        ];
    }
}
