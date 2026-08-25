import type { ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import {
    Card,
    DataTable,
    Icon,
    KpiTile,
    PageHeader,
    StatusBadge,
    type Tone,
} from '@/components/admin/keystone';
import { formatCurrency, formatNumber, formatRelativeTime } from '@/lib/admin/shared';
import type { FunnelStep, OrderRow } from '@/types/keystone';

const statusTone: Record<OrderRow['status'], Tone> = {
    paid: 'success',
    fulfilled: 'info',
    pending: 'warning',
    refunded: 'error',
};

interface OrdersProps {
    recent_orders: OrderRow[];
    order_status_breakdown: FunnelStep[];
    order_total_count: number;
    pending_count: number;
    avg_order_value: number;
    refund_rate: number;
}

export default function Orders({
    recent_orders,
    order_total_count,
    pending_count,
    avg_order_value,
    refund_rate,
}: OrdersProps) {

    return (
        <>
            <Head title="Orders" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Orders"
                    breadcrumbs={['Online Store', 'Orders']}
                    description="Track, fulfill, and refund orders across all channels."
                    actions={
                        <>
                            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200">
                                Export
                            </button>
                            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary-hover">
                                {Icon.plus}
                                Manual order
                            </button>
                        </>
                    }
                />

                <div className="grid grid-cols-12 gap-7">
                    <div className="col-span-12 sm:col-span-6 xl:col-span-3">
                        <KpiTile label="All orders" value={formatNumber(order_total_count)} icon={Icon.orders} />
                    </div>
                    <div className="col-span-12 sm:col-span-6 xl:col-span-3">
                        <KpiTile label="Pending" value={formatNumber(pending_count)} icon={Icon.activity} />
                    </div>
                    <div className="col-span-12 sm:col-span-6 xl:col-span-3">
                        <KpiTile
                            label="Avg order value"
                            value={formatCurrency(avg_order_value, { maximumFractionDigits: 2 })}
                            delta={-2.3}
                            icon={<span className="font-display text-base font-bold">$</span>}
                        />
                    </div>
                    <div className="col-span-12 sm:col-span-6 xl:col-span-3">
                        <KpiTile label="Refund rate" value={`${refund_rate}%`} delta={-0.4} icon={Icon.activity} />
                    </div>
                </div>

                <Card padded={false}>
                    <DataTable<OrderRow>
                        resource="orders"
                        columns={[
                            {
                                key: 'id',
                                label: 'Order',
                                render: (order) => <span className="font-mono font-semibold text-base-content">{order.id}</span>,
                            },
                            { key: 'customer', label: 'Customer' },
                            {
                                key: 'items',
                                label: 'Items',
                                align: 'right',
                                render: (order) => <span className="font-mono">{order.items}</span>,
                            },
                            {
                                key: 'status',
                                label: 'Status',
                                render: (order) => <StatusBadge label={order.status} tone={statusTone[order.status]} />,
                            },
                            {
                                key: 'placed_at',
                                label: 'Placed',
                                muted: true,
                                render: (order) => formatRelativeTime(order.placed_at),
                            },
                            {
                                key: 'total',
                                label: 'Total',
                                align: 'right',
                                render: (order) => (
                                    <span className="font-mono font-semibold">
                                        {formatCurrency(order.total, { maximumFractionDigits: 2 })}
                                    </span>
                                ),
                            },
                        ]}
                        rows={recent_orders}
                    />
                </Card>
            </div>
        </>
    );
}

Orders.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
