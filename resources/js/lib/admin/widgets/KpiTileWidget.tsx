import { type ReactNode } from 'react';
import { Icon } from '@/components/admin/keystone';
import { formatCurrency, formatNumber } from '@/lib/admin/shared';
import type { WidgetComponentProps } from '@/lib/admin/widget-registry';

type KpiMetric = 'revenue' | 'orders' | 'leads' | 'sessions';

interface KpiTileData {
    metric: KpiMetric;
    kpi: {
        label: string;
        value: number;
        format: 'currency' | 'number';
        delta: number;
        delta_label: string;
    };
}

const ICONS: Record<KpiMetric, ReactNode> = {
    revenue: <span key="currency" className="font-display text-base font-bold">$</span>,
    orders: Icon.cart,
    leads: Icon.forms,
    sessions: Icon.reports,
};

/**
 * Renders the KPI body without wrapping in `<KpiTile>` because the dashboard
 * grid already wraps every widget in `<WidgetChrome>` — using the standalone
 * `KpiTile` card here would nest two cards visually.
 */
export function KpiTileWidget({ data }: WidgetComponentProps<KpiTileData>) {
    const { metric, kpi } = data;
    const formatted =
        kpi.format === 'currency'
            ? formatCurrency(kpi.value, { maximumFractionDigits: kpi.value < 1000 ? 2 : 0 })
            : formatNumber(kpi.value);

    const isUp = kpi.delta >= 0;

    return (
        <div className="flex items-start gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
                {ICONS[metric]}
            </span>
            <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-base-content/55">
                    {kpi.label}
                </div>
                <div className="mt-1 font-display text-[26px] font-bold tracking-tight text-base-content">
                    {formatted}
                </div>
                <div
                    className={`mt-1 flex items-center gap-1.5 text-xs font-semibold ${
                        isUp ? 'text-success' : 'text-error'
                    }`}
                >
                    <span
                        className={`grid h-4 w-4 place-items-center rounded-full ${
                            isUp ? 'bg-success/15' : 'bg-error/15'
                        }`}
                    >
                        {isUp ? Icon.arrowUp : Icon.arrowDown}
                    </span>
                    <span>{Math.abs(kpi.delta).toFixed(1)}%</span>
                    <span className="font-medium text-base-content/55">{kpi.delta_label}</span>
                </div>
            </div>
        </div>
    );
}
