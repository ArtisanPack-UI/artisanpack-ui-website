import type { ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import {
    Card,
    DataTable,
    Icon,
    PageHeader,
    StatusBadge,
    type Tone,
} from '@/components/admin/keystone';
import { formatCurrency, formatRelativeTime } from '@/lib/admin/shared';
import type { ProductRow } from '@/types/keystone';

const statusTone: Record<ProductRow['status'], Tone> = {
    active: 'success',
    low_stock: 'warning',
    out_of_stock: 'error',
    draft: 'neutral',
};

const statusLabel: Record<ProductRow['status'], string> = {
    active: 'Active',
    low_stock: 'Low stock',
    out_of_stock: 'Out of stock',
    draft: 'Draft',
};

export default function Products({ products }: { products: ProductRow[] }) {
    return (
        <>
            <Head title="Products" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Products"
                    breadcrumbs={['Online Store', 'Products']}
                    description="Manage products, variants, pricing, and inventory."
                    actions={
                        <>
                            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200">
                                {Icon.upload}
                                Import
                            </button>
                            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary-hover">
                                {Icon.plus}
                                Add product
                            </button>
                        </>
                    }
                />

                <Card padded={false}>
                    <DataTable<ProductRow>
                        resource="products"
                        columns={[
                            {
                                key: 'name',
                                label: 'Product',
                                render: (r) => (
                                    <div className="flex items-center gap-3">
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gradient-to-br from-base-200 to-base-300 text-base-content/55">
                                            {Icon.cart}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="truncate font-semibold text-base-content">{r.name}</div>
                                            <div className="font-mono text-[11px] text-base-content/55">{r.sku}</div>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'status',
                                label: 'Status',
                                render: (r) => <StatusBadge label={statusLabel[r.status]} tone={statusTone[r.status]} />,
                            },
                            {
                                key: 'inventory',
                                label: 'Inventory',
                                align: 'right',
                                render: (r) =>
                                    r.inventory === null ? (
                                        <span className="text-base-content/40">—</span>
                                    ) : (
                                        <span className="font-mono text-base-content">{r.inventory}</span>
                                    ),
                            },
                            {
                                key: 'price',
                                label: 'Price',
                                align: 'right',
                                render: (r) =>
                                    r.price === 0 ? (
                                        <span className="font-mono text-base-content/40">Free</span>
                                    ) : (
                                        <span className="font-mono font-semibold">
                                            {formatCurrency(r.price, { maximumFractionDigits: 2 })}
                                        </span>
                                    ),
                            },
                            {
                                key: 'updated_at',
                                label: 'Updated',
                                muted: true,
                                render: (r) => formatRelativeTime(r.updated_at),
                            },
                        ]}
                        rows={products}
                    />
                </Card>
            </div>
        </>
    );
}

Products.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
