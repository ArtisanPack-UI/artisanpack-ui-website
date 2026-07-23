/**
 * VisitorsChart React component.
 *
 * Renders a time-series area chart of page views and visitors using
 * @artisanpack-ui/react Chart (ApexCharts). Includes granularity
 * selector buttons. Mirrors the Livewire VisitorsChart widget.
 *
 * @since 1.1.0
 */

import React, { useMemo, useState } from 'react';
import { Card, Chart, Button } from '@artisanpack-ui/react';

import type { DateRangePreset } from '../../types';

export interface ChartDataPoint {
    date: string;
    pageviews: number;
    visitors: number;
}

export type Granularity = 'hour' | 'day' | 'week' | 'month';

export interface VisitorsChartProps {
    /** Time-series data points from the API. */
    chartData: ChartDataPoint[];
    /** The active date range preset. */
    dateRangePreset?: DateRangePreset;
    /** Available granularity options. Defaults to ['day', 'week', 'month']. */
    granularityOptions?: Granularity[];
    /** The initial granularity. Defaults to 'day'. */
    defaultGranularity?: Granularity;
    /** Callback when the granularity changes. */
    onGranularityChange?: ( granularity: Granularity ) => void;
    /** Optional CSS class name for the container. */
    className?: string;
}

const granularityLabels: Record<Granularity, string> = {
    hour: 'Hourly',
    day: 'Daily',
    week: 'Weekly',
    month: 'Monthly',
};

export default function VisitorsChart( {
    chartData,
    granularityOptions = [ 'day', 'week', 'month' ],
    defaultGranularity = 'day',
    onGranularityChange,
    className = '',
}: VisitorsChartProps ): React.ReactElement {
    const [ granularity, setGranularity ] = useState<Granularity>( defaultGranularity );

    const handleGranularityChange = ( newGranularity: Granularity ): void => {
        setGranularity( newGranularity );
        onGranularityChange?.( newGranularity );
    };

    const chartSeries = useMemo( () => [
        {
            name: 'Pageviews',
            data: chartData.map( ( d ) => d.pageviews ),
        },
        {
            name: 'Visitors',
            data: chartData.map( ( d ) => d.visitors ),
        },
    ], [ chartData ] );

    const categories = useMemo(
        () => chartData.map( ( d ) => d.date ),
        [ chartData ],
    );

    const headerActions = (
        <div className="flex gap-1">
            {granularityOptions.map( ( option ) => (
                <Button
                    key={option}
                    label={granularityLabels[ option ]}
                    size="xs"
                    color={granularity === option ? 'primary' : 'ghost'}
                    onClick={() => handleGranularityChange( option )}
                />
            ) )}
        </div>
    );

    return (
        <Card
            title="Visitors & Pageviews"
            menu={headerActions}
            className={className}
        >
            {chartData.length === 0 ? (
                <p className="text-base-content/50 text-center py-8">
                    No data available for this period.
                </p>
            ) : (
                <Chart
                    type="area"
                    series={chartSeries}
                    labels={categories}
                    height={300}
                />
            )}
        </Card>
    );
}
