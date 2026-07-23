/**
 * PageAnalytics React component.
 *
 * Displays analytics for a specific page including pageviews, visitors,
 * bounce rate, and a sparkline chart using @artisanpack-ui/react
 * Card, Stat, StatGroup, and Sparkline. Mirrors the Livewire
 * PageAnalytics component.
 *
 * @since 1.1.0
 */

import React, { useMemo } from 'react';
import { Card, Stat, StatGroup, Sparkline, Badge } from '@artisanpack-ui/react';

import type { PageAnalyticsData, PageViewOverTimeItem } from '../../types';

export interface PageAnalyticsProps {
    /** The page path being analyzed. */
    path: string;
    /** Analytics data for the page. */
    analytics: PageAnalyticsData;
    /** Time-series data for the sparkline chart. */
    viewsOverTime?: PageViewOverTimeItem[];
    /** Whether to show the inline chart. Defaults to true. */
    showChart?: boolean;
    /** Whether to use compact layout. Defaults to false. */
    compact?: boolean;
    /** Optional CSS class name for the container. */
    className?: string;
}

export default function PageAnalytics( {
    path,
    analytics,
    viewsOverTime = [],
    showChart = true,
    compact = false,
    className = '',
}: PageAnalyticsProps ): React.ReactElement {
    const chartData = viewsOverTime.length > 0 ? viewsOverTime : analytics.over_time ?? [];

    const sparklineData = useMemo(
        () => chartData.map( ( d ) => d.pageviews ),
        [ chartData ],
    );

    if ( compact ) {
        return (
            <Card compact className={className}>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Badge value={path} color="ghost" size="sm" />
                        <span className="text-sm">
                            {new Intl.NumberFormat().format( analytics.pageviews )} views
                        </span>
                        <span className="text-sm text-base-content/50">
                            {new Intl.NumberFormat().format( analytics.visitors )} visitors
                        </span>
                    </div>
                    {showChart && sparklineData.length >= 2 && (
                        <Sparkline
                            data={sparklineData}
                            type="area"
                            height={30}
                            width={120}
                            color="primary"
                        />
                    )}
                </div>
            </Card>
        );
    }

    return (
        <Card
            title={path}
            className={className}
        >
            <StatGroup>
                <Stat
                    title="Pageviews"
                    value={new Intl.NumberFormat().format( analytics.pageviews )}
                    color="primary"
                    sparklineData={showChart && sparklineData.length >= 2 ? sparklineData : undefined}
                    sparklineType="area"
                />
                <Stat
                    title="Visitors"
                    value={new Intl.NumberFormat().format( analytics.visitors )}
                    color="secondary"
                />
                <Stat
                    title="Bounce Rate"
                    value={analytics.bounce_rate != null ? `${analytics.bounce_rate.toFixed( 1 )}%` : '\u2014'}
                    color="warning"
                />
            </StatGroup>
        </Card>
    );
}
