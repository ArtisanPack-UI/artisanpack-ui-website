/**
 * AnalyticsDashboard React component.
 *
 * Main dashboard layout composing all analytics widgets with date range
 * selection and tab navigation using @artisanpack-ui/react Card, Tabs,
 * Select, and Grid. Designed for use with Inertia.js page props.
 * Mirrors the Livewire AnalyticsDashboard component.
 *
 * @since 1.1.0
 */

import React, { useMemo, useState } from 'react';
import { Card, Tabs, Select, Grid } from '@artisanpack-ui/react';

import type { TabItem } from '@artisanpack-ui/react';
import type {
    ChartDataPoint,
    VisitorsChartProps,
} from '../components/VisitorsChart';
import type { StatsCardsProps } from '../components/StatsCards';
import type { TopPageItem, TrafficSourceItem } from '../../types';

import StatsCards from '../components/StatsCards';
import TopPages from '../components/TopPages';
import TrafficSources from '../components/TrafficSources';
import VisitorsChart from '../components/VisitorsChart';

export interface DateRange {
    start: string;
    end: string;
}

export interface AnalyticsDashboardProps {
    /** Statistics data for the StatsCards widget. */
    stats: StatsCardsProps['stats'];
    /** Time-series chart data points. */
    chartData: ChartDataPoint[];
    /** Top pages data. */
    topPages: TopPageItem[];
    /** Traffic sources data. */
    trafficSources: TrafficSourceItem[];
    /** Current date range. */
    dateRange?: DateRange;
    /** Active date range preset value. */
    dateRangePreset?: string;
    /** Available date range presets. */
    dateRangePresets?: Record<string, string>;
    /** Current filters. */
    filters?: Record<string, unknown>;
    /** Whether bot traffic is included. Bots are excluded by default. */
    includeBots?: boolean;
    /** Callback when the date range preset changes. */
    onDateRangeChange?: ( preset: string ) => void;
    /** Callback when the include-bots toggle changes. */
    onIncludeBotsChange?: ( includeBots: boolean ) => void;
    /** Optional CSS class name for the container. */
    className?: string;
}

const defaultPresets: Record<string, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    this_week: 'This week',
    last_week: 'Last week',
    this_month: 'This month',
    last_month: 'Last month',
    this_year: 'This year',
};

export default function AnalyticsDashboard( {
    stats,
    chartData,
    topPages,
    trafficSources,
    dateRangePreset = '30d',
    dateRangePresets = defaultPresets,
    includeBots = false,
    onDateRangeChange,
    onIncludeBotsChange,
    className = '',
}: AnalyticsDashboardProps ): React.ReactElement {
    const [ activeTab, setActiveTab ] = useState( 'overview' );

    const handlePresetChange = ( e: React.ChangeEvent<HTMLSelectElement> ): void => {
        onDateRangeChange?.( e.target.value );
    };

    const handleIncludeBotsChange = ( e: React.ChangeEvent<HTMLInputElement> ): void => {
        onIncludeBotsChange?.( e.target.checked );
    };

    const presetOptions = useMemo( () => {
        return Object.entries( dateRangePresets ).map( ( [ id, name ] ) => ( {
            id,
            name,
        } ) );
    }, [ dateRangePresets ] );

    const tabItems: TabItem[] = useMemo( () => [
        {
            name: 'overview',
            label: 'Overview',
            content: (
                <div className="space-y-6 pt-4">
                    <StatsCards stats={stats} />
                    <VisitorsChart chartData={chartData} />
                    <Grid cols={1} colsLg={2} gap={6}>
                        <TopPages topPages={topPages} limit={5} />
                        <TrafficSources trafficSources={trafficSources} limit={5} />
                    </Grid>
                </div>
            ),
        },
        {
            name: 'pages',
            label: 'Pages',
            content: (
                <div className="space-y-6 pt-4">
                    <VisitorsChart chartData={chartData} />
                    <TopPages topPages={topPages} />
                </div>
            ),
        },
        {
            name: 'traffic',
            label: 'Traffic',
            content: (
                <div className="space-y-6 pt-4">
                    <TrafficSources trafficSources={trafficSources} />
                </div>
            ),
        },
        {
            name: 'audience',
            label: 'Audience',
            content: (
                <div className="space-y-6 pt-4">
                    <StatsCards stats={stats} />
                </div>
            ),
        },
    ], [ stats, chartData, topPages, trafficSources ] );

    return (
        <div className={`space-y-6 ${className}`.trim()}>
            {/* Header with date range selector */}
            <Card>
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="toggle toggle-sm"
                                checked={includeBots}
                                onChange={handleIncludeBotsChange}
                                disabled={!onIncludeBotsChange}
                                aria-label="Include bot traffic"
                            />
                            <span>Include bot traffic</span>
                        </label>
                        <div className="w-48">
                            <Select
                                options={presetOptions}
                                value={dateRangePreset}
                                onChange={handlePresetChange}
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {/* Tabbed content */}
            <Tabs
                tabs={tabItems}
                activeTab={activeTab}
                onChange={setActiveTab}
                variant="bordered"
            />
        </div>
    );
}
