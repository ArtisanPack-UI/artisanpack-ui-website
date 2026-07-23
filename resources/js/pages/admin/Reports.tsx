import type { ReactNode } from 'react';
import Chart from 'react-apexcharts';
import { Head } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Icon, KpiTile, PageHeader, Widget } from '@/components/admin/keystone';
import { formatCurrency, formatNumber, useChartTheme } from '@/lib/admin/shared';
import type { Kpi, RevenueSeries, TopPage, TrafficSource } from '@/types/keystone';

function RevenueArea({ series, categories }: { series: RevenueSeries['series']; categories: string[] }) {
    const t = useChartTheme();
    const options = {
        chart: { toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
        theme: { mode: t.isDark ? 'dark' : 'light' },
        colors: [t.primary, t.accent],
        stroke: { curve: 'smooth', width: [2.5, 2] },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.32, opacityTo: 0.02 } },
        dataLabels: { enabled: false },
        grid: { borderColor: t.gridline, strokeDashArray: 4 },
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
        legend: { labels: { colors: t.axisLabel } },
        tooltip: { theme: t.isDark ? 'dark' : 'light' },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Chart type="area" height={300} options={options as any} series={series} />;
}

function TrafficBar({ sources }: { sources: TrafficSource[] }) {
    const t = useChartTheme();

    if (sources.length === 0) {
        return (
            <div className="grid h-[260px] place-items-center text-center text-sm text-base-content/55">
                No traffic data for the last 30 days yet.
            </div>
        );
    }

    const options = {
        chart: { toolbar: { show: false }, fontFamily: 'inherit', background: 'transparent' },
        theme: { mode: t.isDark ? 'dark' : 'light' },
        colors: [t.primary],
        plotOptions: { bar: { borderRadius: 6, horizontal: true, barHeight: '60%' } },
        dataLabels: { enabled: false },
        grid: { borderColor: t.gridline, strokeDashArray: 4 },
        xaxis: {
            categories: sources.map((s) => s.source),
            labels: { style: { colors: t.axisLabel, fontSize: '11px' } },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: { labels: { style: { colors: t.axisLabel, fontSize: '11px' } } },
        tooltip: { theme: t.isDark ? 'dark' : 'light' },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Chart type="bar" height={260} options={options as any} series={[{ name: 'Visitors', data: sources.map((s) => s.visitors) }]} />;
}

function TopPagesTable({ pages }: { pages: TopPage[] }) {
    if (pages.length === 0) {
        return (
            <div className="grid h-[200px] place-items-center text-center text-sm text-base-content/55">
                No page views for the last 30 days yet.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-base-content/55">
                    <tr>
                        <th className="pb-2 pr-3">Page</th>
                        <th className="pb-2 pr-3 text-right">Views</th>
                        <th className="pb-2 text-right">Unique</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-base-300/60">
                    {pages.map((page) => (
                        <tr key={page.path}>
                            <td className="py-2 pr-3">
                                <div className="font-medium text-base-content">{page.title || page.path}</div>
                                {page.title ? (
                                    <div className="text-xs text-base-content/55">{page.path}</div>
                                ) : null}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(page.views)}</td>
                            <td className="py-2 text-right tabular-nums">{formatNumber(page.unique_views)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

interface ReportsProps {
    kpis: Kpi[];
    revenue_series: RevenueSeries;
    top_pages: TopPage[];
    traffic_sources: TrafficSource[];
}

export default function Reports({ kpis, revenue_series, top_pages, traffic_sources }: ReportsProps) {
    // KPI icons cycle through the available admin glyphs via modulo indexing
    // so any number of KPIs always gets an icon — a future addition wraps
    // back to `Icon.reports` rather than rendering as a blank tile.
    const kpiIcons: ReactNode[] = [Icon.reports, Icon.users, Icon.activity, Icon.cart];

    return (
        <>
            <Head title="Reports" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Reports"
                    description="Site-wide analytics for traffic, top pages, and traffic sources."
                    actions={
                        <>
                            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200">
                                Last 30 days
                                {Icon.chevronDown}
                            </button>
                            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200">
                                Export PDF
                            </button>
                        </>
                    }
                />

                <div className="grid grid-cols-12 gap-7">
                    {kpis.map((kpi, idx) => (
                        <div key={kpi.label} className="col-span-12 sm:col-span-6 xl:col-span-3">
                            <KpiTile
                                label={kpi.label}
                                value={
                                    kpi.format === 'currency'
                                        ? formatCurrency(kpi.value, { maximumFractionDigits: kpi.value < 1000 ? 2 : 0 })
                                        : formatNumber(kpi.value)
                                }
                                delta={kpi.delta}
                                deltaLabel={kpi.delta_label}
                                icon={kpiIcons[idx % kpiIcons.length]}
                            />
                        </div>
                    ))}

                    <div className="col-span-12 xl:col-span-8">
                        <Widget title="Revenue over time" subtitle="Compared to previous period">
                            <RevenueArea series={revenue_series.series} categories={revenue_series.categories} />
                        </Widget>
                    </div>

                    <div className="col-span-12 xl:col-span-4">
                        <Widget title="Traffic sources" subtitle="Sessions by channel">
                            <TrafficBar sources={traffic_sources} />
                        </Widget>
                    </div>

                    <div className="col-span-12">
                        <Widget title="Top pages" subtitle="Most viewed pages over the last 30 days">
                            <TopPagesTable pages={top_pages} />
                        </Widget>
                    </div>
                </div>
            </div>
        </>
    );
}

Reports.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
