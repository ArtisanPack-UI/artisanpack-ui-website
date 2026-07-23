/**
 * MultiTenantDashboard React component.
 *
 * Wraps the AnalyticsDashboard with site selection functionality for
 * multi-tenant environments using @artisanpack-ui/react Card.
 * Mirrors the Livewire MultiTenantDashboard component.
 *
 * @since 1.1.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '@artisanpack-ui/react';

import type { StatsCardsProps } from '../components/StatsCards';
import type { ChartDataPoint } from '../components/VisitorsChart';
import type { Site, TopPageItem, TrafficSourceItem } from '../../types';

import AnalyticsDashboard from './AnalyticsDashboard';
import SiteSelector from '../components/SiteSelector';

export interface MultiTenantDashboardProps {
    /** Array of available sites for selection. */
    sites: Site[];
    /** The initially selected site ID. */
    initialSiteId?: number | null;
    /** Whether multi-tenant mode is enabled. */
    multiTenantEnabled?: boolean;
    /** Statistics data for the StatsCards widget. */
    stats: StatsCardsProps['stats'];
    /** Time-series chart data points. */
    chartData: ChartDataPoint[];
    /** Top pages data. */
    topPages: TopPageItem[];
    /** Traffic sources data. */
    trafficSources: TrafficSourceItem[];
    /** Active date range preset value. */
    dateRangePreset?: string;
    /** Available date range presets. */
    dateRangePresets?: Record<string, string>;
    /** Callback when the selected site changes. */
    onSiteChange?: ( siteId: number ) => void;
    /** Callback when the date range preset changes. */
    onDateRangeChange?: ( preset: string ) => void;
    /** Optional CSS class name for the container. */
    className?: string;
}

export default function MultiTenantDashboard( {
    sites,
    initialSiteId = null,
    multiTenantEnabled = true,
    stats,
    chartData,
    topPages,
    trafficSources,
    dateRangePreset,
    dateRangePresets,
    onSiteChange,
    onDateRangeChange,
    className = '',
}: MultiTenantDashboardProps ): React.ReactElement {
    const [ selectedSiteId, setSelectedSiteId ] = useState<number | null>( initialSiteId );

    useEffect( () => {
        setSelectedSiteId( initialSiteId );
    }, [ initialSiteId ] );

    const handleSiteChange = useCallback( ( siteId: number ): void => {
        setSelectedSiteId( siteId );
        onSiteChange?.( siteId );
    }, [ onSiteChange ] );

    return (
        <div className={`space-y-6 ${className}`.trim()}>
            {multiTenantEnabled && sites.length > 1 && (
                <Card>
                    <SiteSelector
                        sites={sites}
                        selectedSiteId={selectedSiteId}
                        onSiteChange={handleSiteChange}
                    />
                </Card>
            )}

            <AnalyticsDashboard
                stats={stats}
                chartData={chartData}
                topPages={topPages}
                trafficSources={trafficSources}
                dateRangePreset={dateRangePreset}
                dateRangePresets={dateRangePresets}
                onDateRangeChange={onDateRangeChange}
            />
        </div>
    );
}
