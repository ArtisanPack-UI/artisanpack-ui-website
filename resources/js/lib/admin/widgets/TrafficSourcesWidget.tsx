import Chart from 'react-apexcharts';
import { formatNumber, useChartTheme } from '@/lib/admin/shared';
import type { WidgetComponentProps } from '@/lib/admin/widget-registry';
import type { TrafficSource } from '@/types/keystone';

interface TrafficSourcesData {
    sources: TrafficSource[];
}

export function TrafficSourcesWidget({ data }: WidgetComponentProps<TrafficSourcesData>) {
    const t = useChartTheme();
    const { sources } = data;

    if (sources.length === 0) {
        return (
            <div className="grid h-[300px] place-items-center text-center text-sm text-base-content/55">
                No traffic data for the last 30 days yet.
            </div>
        );
    }

    const palette = [t.primary, t.accent, t.secondary, '#94a3b8', '#cbd5e1'];

    const options = {
        chart: { fontFamily: 'inherit', background: 'transparent' },
        theme: { mode: t.isDark ? 'dark' : 'light' },
        colors: palette,
        labels: sources.map((s) => s.source),
        stroke: { width: 0 },
        legend: {
            position: 'bottom',
            fontSize: '12px',
            labels: { colors: t.axisLabel },
            markers: { width: 8, height: 8, radius: 8 },
            itemMargin: { horizontal: 6, vertical: 4 },
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '72%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total',
                            color: t.axisLabel,
                            formatter: () =>
                                formatNumber(sources.reduce((sum, s) => sum + s.visitors, 0)),
                        },
                        value: {
                            color: t.isDark ? '#e2e8f0' : '#0f172a',
                            fontSize: '20px',
                            fontWeight: 700,
                        },
                    },
                },
            },
        },
        dataLabels: { enabled: false },
        tooltip: { theme: t.isDark ? 'dark' : 'light' },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Chart type="donut" height={300} options={options as any} series={sources.map((s) => s.visitors)} />;
}
