/**
 * RealtimeVisitors React component.
 *
 * Displays the current number of active visitors with optional polling
 * for live updates using @artisanpack-ui/react Stat, Card, and Badge.
 * Mirrors the Livewire RealtimeVisitors widget.
 *
 * @since 1.1.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, Stat, Badge, Loading } from '@artisanpack-ui/react';

import type { RealtimeData } from '../../types';

/**
 * Normalize a raw API payload into a safe RealtimeData shape.
 */
function normalizeRealtimeData( payload: unknown ): RealtimeData {
    if ( payload && typeof payload === 'object' ) {
        const obj = payload as Record<string, unknown>;

        return {
            active_visitors: typeof obj.active_visitors === 'number' ? obj.active_visitors : 0,
            recent_pageviews: Array.isArray( obj.recent_pageviews )
                ? obj.recent_pageviews.map( ( pv: Record<string, unknown> ) => ( {
                    path: typeof pv?.path === 'string' ? pv.path : '',
                    timestamp: typeof pv?.timestamp === 'string' ? pv.timestamp : '',
                } ) )
                : [],
        };
    }

    return { active_visitors: 0, recent_pageviews: [] };
}

export interface RealtimeVisitorsProps {
    /** Initial realtime data (e.g. from Inertia page props). */
    initialData?: RealtimeData;
    /** Polling interval in milliseconds. Defaults to 10000 (10s). Set to 0 to disable. */
    pollInterval?: number;
    /** Number of minutes of activity to consider. Defaults to 5. */
    minutes?: number;
    /** Optional CSS class name for the container. */
    className?: string;
}

export default function RealtimeVisitors( {
    initialData,
    pollInterval = 10000,
    minutes = 5,
    className = '',
}: RealtimeVisitorsProps ): React.ReactElement {
    const [ data, setData ] = useState<RealtimeData | null>( initialData ?? null );
    const [ previousCount, setPreviousCount ] = useState<number | null>( initialData?.active_visitors ?? null );
    const [ loading, setLoading ] = useState( ! initialData );
    const [ error, setError ] = useState<string | null>( null );
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>( null );

    const fetchRealtime = useCallback( async (): Promise<void> => {
        try {
            const response = await fetch(
                `/api/analytics/realtime?minutes=${minutes}`,
                {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'same-origin',
                },
            );

            if ( ! response.ok ) {
                throw new Error( `HTTP ${response.status}` );
            }

            const json = await response.json();
            const realtimeData = normalizeRealtimeData( json.data ?? json );

            setData( ( prev ) => {
                if ( prev ) {
                    setPreviousCount( prev.active_visitors );
                }

                return realtimeData;
            } );
            setError( null );
        } catch ( err ) {
            setError( err instanceof Error ? err.message : 'Failed to fetch realtime data' );
        } finally {
            setLoading( false );
        }
    }, [ minutes ] );

    useEffect( () => {
        if ( ! initialData ) {
            fetchRealtime();
        }
    }, [ fetchRealtime, initialData ] );

    useEffect( () => {
        if ( pollInterval > 0 ) {
            intervalRef.current = setInterval( fetchRealtime, pollInterval );
        }

        return () => {
            if ( intervalRef.current ) {
                clearInterval( intervalRef.current );
            }
        };
    }, [ fetchRealtime, pollInterval ] );

    const activeVisitors = data?.active_visitors ?? 0;
    const trend = previousCount !== null ? activeVisitors - previousCount : 0;
    const hasTrend = previousCount !== null && trend !== 0;
    const isActive = activeVisitors > 0;

    return (
        <Card
            title="Realtime Visitors"
            menu={
                <Badge
                    color={isActive ? 'success' : 'neutral'}
                    value={isActive ? 'Live' : 'Idle'}
                    size="sm"
                />
            }
            className={className}
        >
            {loading ? (
                <div className="flex justify-center py-8">
                    <Loading size="lg" />
                </div>
            ) : error ? (
                <p className="text-error text-center py-4">{error}</p>
            ) : (
                <div className="space-y-4">
                    <Stat
                        title="Active Now"
                        value={new Intl.NumberFormat().format( activeVisitors )}
                        color={isActive ? 'success' : 'neutral'}
                        change={hasTrend ? ( trend / Math.max( previousCount!, 1 ) ) * 100 : undefined}
                        changeLabel="from last poll"
                    />

                    {data?.recent_pageviews && data.recent_pageviews.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold mb-2">Recent Activity</h4>
                            <div className="space-y-1">
                                {data.recent_pageviews.slice( 0, 5 ).map( ( pv, index ) => (
                                    <div
                                        key={`${pv.path}-${pv.timestamp}-${index}`}
                                        className="flex items-center justify-between text-sm"
                                    >
                                        <span className="font-mono text-base-content/70 truncate">
                                            {pv.path}
                                        </span>
                                        <Badge
                                            value={new Date( pv.timestamp ).toLocaleTimeString()}
                                            size="xs"
                                            color="ghost"
                                        />
                                    </div>
                                ) )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}
