<?php

declare(strict_types=1);

namespace App\SiteEditor\Widgets;

use App\Models\User;
use App\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface;
use App\Support\KeystoneSampleData;

/**
 * Recent orders table, limited to the latest few rows.
 *
 * Demo-data backed until the commerce admin lands in issue #28. The slicing
 * happens here (not in `KeystoneSampleData`) so the sample helper keeps a
 * stable canonical row set callers can reuse across widgets and pages.
 */
class RecentOrdersWidget implements KeystoneAdminWidgetInterface
{
    private const DEFAULT_LIMIT = 6;

    /**
     * @return array{title: string, description: string, default_options: array{limit: int}}
     */
    public static function getWidgetInfo(): array
    {
        return [
            'title'           => 'Recent orders',
            'description'     => 'Latest store activity at a glance.',
            'default_options' => [
                'limit' => self::DEFAULT_LIMIT,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     *
     * @return array{orders: list<array{id: string, customer: string, total: float, status: string, placed_at: string, items: int}>}
     */
    public static function getData(User $user, array $options): array
    {
        $limit = self::resolveLimit($options);

        return [
            'orders' => array_slice(KeystoneSampleData::recentOrders(), 0, $limit),
        ];
    }

    /**
     * @return array{component: string, is_demo: bool}
     */
    public static function extendedInfo(): array
    {
        return [
            'component' => 'RecentOrdersWidget',
            'is_demo'   => true,
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     */
    private static function resolveLimit(array $options): int
    {
        $candidate = $options['limit'] ?? null;

        if (is_int($candidate) && $candidate > 0) {
            return $candidate;
        }

        return self::DEFAULT_LIMIT;
    }
}
