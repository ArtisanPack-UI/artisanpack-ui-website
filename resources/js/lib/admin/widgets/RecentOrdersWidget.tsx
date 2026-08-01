import { DataTable, StatusBadge, type Tone } from '@/components/admin/keystone';
import { formatCurrency, formatRelativeTime } from '@/lib/admin/shared';
import type { WidgetComponentProps } from '@/lib/admin/widget-registry';
import type { OrderRow } from '@/types/keystone';

interface RecentOrdersData {
    orders: OrderRow[];
}

const ORDER_STATUS_TONE: Record<string, Tone> = {
    paid: 'success',
    fulfilled: 'info',
    pending: 'warning',
    refunded: 'error',
};

export function RecentOrdersWidget({ data }: WidgetComponentProps<RecentOrdersData>) {
    return (
        <DataTable<OrderRow>
            resource="widgets.recentOrders"
            columns={[
                { key: 'id', label: 'Order' },
                { key: 'customer', label: 'Customer' },
                {
                    key: 'status',
                    label: 'Status',
                    render: (r) => (
                        <StatusBadge
                            label={r.status}
                            tone={ORDER_STATUS_TONE[r.status] ?? 'neutral'}
                        />
                    ),
                },
                {
                    key: 'placed_at',
                    label: 'Placed',
                    muted: true,
                    render: (r) => formatRelativeTime(r.placed_at),
                },
                {
                    key: 'total',
                    label: 'Total',
                    align: 'right',
                    render: (r) => (
                        <span className="font-mono font-semibold">
                            {formatCurrency(r.total, { maximumFractionDigits: 2 })}
                        </span>
                    ),
                },
            ]}
            rows={data.orders}
        />
    );
}
