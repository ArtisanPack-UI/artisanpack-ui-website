import { StatusBadge } from '@/components/admin/keystone';
import type { WidgetComponentProps } from '@/lib/admin/widget-registry';
import type { ProductRow } from '@/types/keystone';

interface InventoryAlertsData {
    products: ProductRow[];
}

export function InventoryAlertsWidget({ data }: WidgetComponentProps<InventoryAlertsData>) {
    if (data.products.length === 0) {
        return (
            <div className="grid h-32 place-items-center text-sm text-base-content/55">
                All stocked.
            </div>
        );
    }

    return (
        <ul className="flex flex-col gap-2.5">
            {data.products.map((product) => (
                <li
                    key={product.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-base-300/40 px-3 py-2.5"
                >
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-base-content">
                            {product.name}
                        </div>
                        <div className="font-mono text-[11px] text-base-content/55">
                            {product.sku}
                        </div>
                    </div>
                    <StatusBadge
                        label={
                            product.status === 'out_of_stock'
                                ? 'Out of stock'
                                : `${product.inventory} left`
                        }
                        tone={product.status === 'out_of_stock' ? 'error' : 'warning'}
                    />
                </li>
            ))}
        </ul>
    );
}
