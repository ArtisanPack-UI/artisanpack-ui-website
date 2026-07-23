import Chart from 'react-apexcharts';
import { formatCurrency, useChartTheme } from '@/lib/admin/shared';
import type { WidgetComponentProps } from '@/lib/admin/widget-registry';
import type { RevenueSeries } from '@/types/keystone';

interface RevenueTrendData {
    series: RevenueSeries;
}

export function RevenueTrendWidget({ data }: WidgetComponentProps<RevenueTrendData>) {
    const t = useChartTheme();
    const { series, categories } = data.series;

    const options = {
        chart: {
            toolbar: { show: false },
            zoom: { enabled: false },
            animations: { enabled: true, speed: 280 },
            fontFamily: 'inherit',
            background: 'transparent',
        },
        theme: { mode: t.isDark ? 'dark' : 'light' },
        colors: [t.primary, t.accent],
        stroke: { curve: 'smooth', width: [2.5, 2] },
        fill: {
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.32, opacityTo: 0.02, stops: [0, 100] },
        },
        dataLabels: { enabled: false },
        grid: { borderColor: t.gridline, strokeDashArray: 4, padding: { left: 0, right: 0 } },
        xaxis: {
            categories,
            labels: { style: { colors: t.axisLabel, fontSize: '11px' } },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            labels: {
                style: { colors: t.axisLabel, fontSize: '11px' },
                formatter: (v: number) => `$${(v / 1000).toFixed(1)}k`,
            },
        },
        tooltip: {
            theme: t.isDark ? 'dark' : 'light',
            y: { formatter: (v: number) => formatCurrency(v) },
        },
        legend: { show: false },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Chart type="area" height={260} options={options as any} series={series} />;
}
