/**
 * BotTraffic React component.
 *
 * Surfaces bot traffic that is filtered out of the main reports by default:
 * total bot visits, the bot share of total traffic, the busiest bot user
 * agents, and a bot-only visit trend. Mirrors the Livewire BotTraffic widget.
 *
 * @since 1.2.0
 */

import React from 'react';
import { Card, Table, Loading } from '@artisanpack-ui/react';

import { useAnalyticsApi } from '../hooks/useAnalyticsApi';

import type { TableHeader } from '@artisanpack-ui/react';
import type { BotAgentItem, BotStatsData, DateRangePreset } from '../../types';

export interface BotTrafficProps {
    /** Date range preset to query. Defaults to '30d'. */
    period?: DateRangePreset;
    /** Optional site ID filter. */
    siteId?: number;
    /** Maximum number of bot user agents to display. */
    limit?: number;
    /** Initial data (e.g. from Inertia page props) to render before fetching. */
    initialData?: BotStatsData;
    /** Current bot-inclusion state of the main dashboard charts. */
    includeBots?: boolean;
    /** Called when the user toggles bot traffic in the main dashboard charts. */
    onIncludeBotsChange?: ( includeBots: boolean ) => void;
    /** Optional CSS class name for the container. */
    className?: string;
}

const agentHeaders: TableHeader<BotAgentItem>[] = [
    { key: 'user_agent', label: 'Bot user agent' },
    { key: 'visits', label: 'Visits' },
];

const numberFormatter = new Intl.NumberFormat();

export default function BotTraffic( {
    period = '30d',
    siteId,
    limit = 10,
    initialData,
    includeBots,
    onIncludeBotsChange,
    className = '',
}: BotTrafficProps ): React.ReactElement {
    const normalizedLimit = Number.isFinite( limit )
        ? Math.min( 100, Math.max( 1, Math.floor( limit ) ) )
        : 10;

    const { data, loading, error } = useAnalyticsApi<BotStatsData>( {
        endpoint: 'bots',
        params: { period, site_id: siteId, limit: normalizedLimit },
        initialData,
        fetchOnMount: ! initialData,
    } );

    const stats = data ?? initialData;
    const trend = stats?.trend ?? [];
    const trendMax = Math.max( 1, ...trend.map( ( point ) => point.visits ) );
    const topAgents = ( stats?.top_agents ?? [] ).slice( 0, normalizedLimit );

    return (
        <Card title="Bot Traffic" className={className}>
            <p className="text-sm text-base-content/60 mb-4">
                Traffic identified as bots and excluded from your reports by default.
            </p>

            {onIncludeBotsChange && (
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none mb-4">
                    <input
                        type="checkbox"
                        className="toggle toggle-sm"
                        checked={includeBots ?? false}
                        onChange={( event ) => onIncludeBotsChange( event.target.checked )}
                        aria-label="Include bot traffic in dashboard charts"
                    />
                    <span>Include bot traffic in dashboard charts</span>
                </label>
            )}

            {loading && ! stats ? (
                <div className="flex justify-center py-8">
                    <Loading size="lg" />
                </div>
            ) : error && ! stats ? (
                <p className="text-error text-center py-4">{error}</p>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-box bg-base-200 p-4">
                            <div className="text-xs uppercase tracking-wide text-base-content/50">
                                Bot visits
                            </div>
                            <div className="text-2xl font-bold font-mono">
                                {numberFormatter.format( stats?.bot_visits ?? 0 )}
                            </div>
                        </div>
                        <div className="rounded-box bg-base-200 p-4">
                            <div className="text-xs uppercase tracking-wide text-base-content/50">
                                % of total traffic
                            </div>
                            <div className="text-2xl font-bold font-mono">
                                {( stats?.bot_percentage ?? 0 ).toFixed( 1 )}%
                            </div>
                        </div>
                    </div>

                    {trend.length > 0 && (
                        <div>
                            <div className="text-xs uppercase tracking-wide text-base-content/50 mb-2">
                                Bot traffic trend
                            </div>
                            <div
                                className="flex items-end gap-px h-16"
                                role="img"
                                aria-label="Bot visits over time for the selected date range."
                            >
                                {trend.map( ( point, index ) => (
                                    <div
                                        key={`${point.date}-${index}`}
                                        className="flex-1 bg-primary/60 rounded-t min-h-[2px]"
                                        style={{
                                            height: `${Math.max( 2, Math.round( ( point.visits / trendMax ) * 100 ) )}%`,
                                        }}
                                        title={`${point.date}: ${numberFormatter.format( point.visits )}`}
                                    />
                                ) )}
                            </div>
                        </div>
                    )}

                    <Table<BotAgentItem>
                        headers={agentHeaders}
                        rows={topAgents}
                        striped
                    />
                </div>
            )}
        </Card>
    );
}
