<?php

declare(strict_types=1);

namespace App\SiteEditor\Widgets;

use App\Models\User;
use App\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface;
use App\Support\KeystoneSampleData;

/**
 * Inventory-attention list — products in `low_stock` or `out_of_stock` state.
 *
 * Demo-data backed until the commerce admin lands in issue #28. Filtering
 * happens here (not in `KeystoneSampleData`) so the sample helper continues
 * to return the canonical product list other widgets and pages share.
 */
class InventoryAlertsWidget implements KeystoneAdminWidgetInterface
{
    /**
     * Product statuses surfaced by the widget. `draft` and `active` are
     * intentionally excluded — they're not actionable from an inventory
     * alerts standpoint.
     *
     * @var list<string>
     */
    private const ATTENTION_STATUSES = ['low_stock', 'out_of_stock'];

    /**
     * @return array{title: string, description: string}
     */
    public static function getWidgetInfo(): array
    {
        return [
            'title'       => 'Inventory alerts',
            'description' => 'Products that are low or out of stock.',
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     *
     * @return array{products: list<array{id: int, name: string, sku: string, price: float, inventory: int|null, status: string, updated_at: string}>}
     */
    public static function getData(User $user, array $options): array
    {
        $alerts = array_values(array_filter(
            KeystoneSampleData::products(),
            static fn (array $product): bool => in_array($product['status'] ?? null, self::ATTENTION_STATUSES, true),
        ));

        return [
            'products' => $alerts,
        ];
    }

    /**
     * @return array{component: string, is_demo: bool}
     */
    public static function extendedInfo(): array
    {
        return [
            'component' => 'InventoryAlertsWidget',
            'is_demo'   => true,
        ];
    }
}
