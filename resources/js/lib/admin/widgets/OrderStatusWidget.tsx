import Chart from 'react-apexcharts';
import { useChartTheme } from '@/lib/admin/shared';
import type { WidgetComponentProps } from '@/lib/admin/widget-registry';
import type { FunnelStep } from '@/types/keystone';

interface OrderStatusData {
    breakdown: FunnelStep[];
}

export function OrderStatusWidget({ data }: WidgetComponentProps<OrderStatusData>) {
    const t = useChartTheme();
    const { breakdown } = data;

    const options = {
        chart: { toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
        theme: { mode: t.isDark ? 'dark' : 'light' },
        colors: [t.primary, t.accent, t.warning, t.danger],
        plotOptions: { bar: { borderRadius: 6, columnWidth: '52%', distributed: true } },
        dataLabels: { enabled: false },
        grid: { borderColor: t.gridline, strokeDashArray: 4 },
        xaxis: {
            categories: breakdown.map((b) => b.label),
            labels: { style: { colors: t.axisLabel, fontSize: '11px' } },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: { labels: { style: { colors: t.axisLabel, fontSize: '11px' } } },
        legend: { show: false },
        tooltip: { theme: t.isDark ? 'dark' : 'light' },
    };

    return (
        <Chart
            type="bar"
            height={220}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            options={options as any}
            series={[{ name: 'Orders', data: breakdown.map((b) => b.value) }]}
        />
    );
}
