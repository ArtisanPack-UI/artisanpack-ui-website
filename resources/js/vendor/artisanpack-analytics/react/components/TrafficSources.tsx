/**
 * TrafficSources React component.
 *
 * Displays a table of traffic sources with session and visitor counts
 * using @artisanpack-ui/react Table and Chart. Mirrors the Livewire
 * TrafficSources widget.
 *
 * @since 1.1.0
 */

import React, { useMemo } from 'react';
import { Card, Table } from '@artisanpack-ui/react';

import type { TableHeader } from '@artisanpack-ui/react';
import type { TrafficSourceItem } from '../../types';

export interface TrafficSourcesProps {
    /** Array of traffic source data from the API. */
    trafficSources: TrafficSourceItem[];
    /** Maximum number of sources to display. */
    limit?: number;
    /** Optional CSS class name for the container. */
    className?: string;
}

interface TrafficSourceRow extends TrafficSourceItem {
    percentage: string;
}

const headers: TableHeader<TrafficSourceRow>[] = [
    { key: 'source', label: 'Source', sortable: true },
    { key: 'medium', label: 'Medium', sortable: true },
    { key: 'sessions', label: 'Sessions', sortable: true },
    { key: 'visitors', label: 'Visitors', sortable: true },
    { key: 'percentage', label: '%', sortable: true },
];

export default function TrafficSources( {
    trafficSources,
    limit = 10,
    className = '',
}: TrafficSourcesProps ): React.ReactElement {
    const totalSessions = useMemo(
        () => trafficSources.reduce( ( sum, s ) => sum + s.sessions, 0 ),
        [ trafficSources ],
    );

    const displayData: TrafficSourceRow[] = useMemo( () => {
        return trafficSources.slice( 0, limit ).map( ( source ) => ( {
            ...source,
            source: source.source || '(direct)',
            medium: source.medium || '(none)',
            percentage: totalSessions > 0
                ? `${( ( source.sessions / totalSessions ) * 100 ).toFixed( 1 )}%`
                : '0.0%',
        } ) );
    }, [ trafficSources, totalSessions, limit ] );

    return (
        <Card title="Traffic Sources" className={className}>
            <Table<TrafficSourceRow>
                headers={headers}
                rows={displayData}
                striped
            />
        </Card>
    );
}
