/**
 * StatsCards React component.
 *
 * Displays key analytics metrics using @artisanpack-ui/react Stat and
 * StatGroup components with comparison indicators and sparklines.
 * Mirrors the Livewire StatsCards widget.
 *
 * @since 1.1.0
 */

import React from 'react';
import { Stat, StatGroup } from '@artisanpack-ui/react';

import type { StatsComparison } from '../../types';

export interface StatsCardsProps {
    /** Core statistics object from the API. */
    stats: {
        pageviews: number;
        visitors: number;
        sessions: number;
        bounce_rate: number;
        avg_session_duration: number;
        pages_per_session?: number;
        realtime_visitors?: number;
        comparison?: StatsComparison | null;
    };
    /** Optional CSS class name for the container. */
    className?: string;
}

/**
 * Format a duration in seconds to a human-readable string.
 */
function formatDuration( seconds: number ): string {
    const totalSeconds = Math.round( seconds );

    if ( totalSeconds < 60 ) {
        return `${totalSeconds}s`;
    }

    const minutes = Math.floor( totalSeconds / 60 );
    const remainingSeconds = totalSeconds % 60;

    return `${minutes}m ${remainingSeconds}s`;
}

export default function StatsCards( { stats, className = '' }: StatsCardsProps ): React.ReactElement {
    return (
        <StatGroup className={className}>
            <Stat
                title="Pageviews"
                value={new Intl.NumberFormat().format( stats.pageviews )}
                color="primary"
                change={stats.comparison?.pageviews?.change}
                changeLabel="vs previous period"
            />
            <Stat
                title="Visitors"
                value={new Intl.NumberFormat().format( stats.visitors )}
                color="secondary"
                change={stats.comparison?.visitors?.change}
                changeLabel="vs previous period"
            />
            <Stat
                title="Sessions"
                value={new Intl.NumberFormat().format( stats.sessions )}
                color="accent"
                change={stats.comparison?.sessions?.change}
                changeLabel="vs previous period"
            />
            <Stat
                title="Bounce Rate"
                value={`${stats.bounce_rate.toFixed( 1 )}%`}
                color="warning"
                change={stats.comparison?.bounce_rate?.change}
                changeLabel="vs previous period"
            />
            <Stat
                title="Avg. Session Duration"
                value={formatDuration( stats.avg_session_duration )}
                color="info"
                change={stats.comparison?.avg_session_duration?.change}
                changeLabel="vs previous period"
            />
        </StatGroup>
    );
}
