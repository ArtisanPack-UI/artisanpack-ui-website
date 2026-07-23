import type { ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import { Avatar } from '@artisanpack-ui/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, DataTable, Icon, PageHeader } from '@/components/admin/keystone';
import { formatCurrency, formatRelativeTime, initialsOf } from '@/lib/admin/shared';
import type { CustomerRow } from '@/types/keystone';

export default function Customers({ customers }: { customers: CustomerRow[] }) {
    return (
        <>
            <Head title="Customers" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Customers"
                    breadcrumbs={['Online Store', 'Customers']}
                    description="Customer profiles, order history, and lifetime value."
                    actions={
                        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90">
                            {Icon.plus}
                            Add customer
                        </button>
                    }
                />

                <Card padded={false}>
                    <DataTable<CustomerRow>
                        columns={[
                            {
                                key: 'name',
                                label: 'Customer',
                                render: (r) => (
                                    <div className="flex items-center gap-3">
                                        <Avatar placeholder={initialsOf(r.name)} color="primary" size="sm" />
                                        <div>
                                            <div className="font-semibold text-base-content">{r.name}</div>
                                            <div className="text-[11px] text-base-content/55">{r.email}</div>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'orders',
                                label: 'Orders',
                                align: 'right',
                                render: (r) => <span className="font-mono">{r.orders}</span>,
                            },
                            {
                                key: 'lifetime',
                                label: 'Lifetime value',
                                align: 'right',
                                render: (r) => (
                                    <span className="font-mono font-semibold">
                                        {formatCurrency(r.lifetime, { maximumFractionDigits: 2 })}
                                    </span>
                                ),
                            },
                            {
                                key: 'last_seen',
                                label: 'Last seen',
                                muted: true,
                                render: (r) => formatRelativeTime(r.last_seen),
                            },
                        ]}
                        rows={customers}
                    />
                </Card>
            </div>
        </>
    );
}

Customers.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
