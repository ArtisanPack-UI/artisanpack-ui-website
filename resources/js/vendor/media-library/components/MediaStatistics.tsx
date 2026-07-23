/**
 * ArtisanPack UI Media Library - MediaStatistics Component
 *
 * KPI dashboard with file count, storage usage, type breakdown,
 * and sparkline charts for recent upload trends.
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import React, { useState, useEffect } from 'react';
import { Card, Stat, StatGroup, Badge, Progress, Loading, Sparkline } from '@artisanpack-ui/react';
import { cn } from '@artisanpack-ui/tokens';

import type { Media, MediaType } from '../types/media';

import { fetchMedia } from '../utils/api';

/**
 * Statistics data structure.
 */
interface MediaStats {
    totalCount: number;
    totalSize: number;
    totalSizeFormatted: string;
    byType: Record<MediaType, { count: number; size: number; sizeFormatted: string }>;
    recentUploads: number;
    dailyUploads: number[];
    /** True when there are too many items for client-side aggregation. */
    detailsUnavailable: boolean;
}

/**
 * Props for the MediaStatistics component.
 */
export interface MediaStatisticsProps {
    /** Number of recent days to analyze. Defaults to 30. */
    recentDays?: number;
    /** Additional CSS class names. */
    className?: string;
}

/**
 * Format bytes to a human-readable string.
 */
function formatBytes( bytes: number ): string {
    if ( bytes === 0 ) {
        return '0 B';
    }

    const units = [ 'B', 'KB', 'MB', 'GB', 'TB' ];
    const i     = Math.floor( Math.log( bytes ) / Math.log( 1024 ) );
    const size  = bytes / Math.pow( 1024, i );

    return `${ size.toFixed( i > 0 ? 1 : 0 ) } ${ units[i] }`;
}

/**
 * KPI dashboard for media library statistics.
 */
export const MediaStatistics: React.FC<MediaStatisticsProps> = ( {
    recentDays = 30,
    className,
} ) => {
    const [ stats, setStats ]       = useState<MediaStats | null>( null );
    const [ loading, setLoading ]   = useState( true );

    useEffect( () => {
        const loadStats = async () => {
            setLoading( true );

            try {
                // First check total count with a small page, then fetch all if under threshold
                const probe = await fetchMedia( { per_page: 1 } );
                const totalCount = probe.meta.total;
                const SAFE_THRESHOLD = 2000;
                const detailsUnavailable = totalCount > SAFE_THRESHOLD;

                let allMedia: Media[];
                if ( detailsUnavailable ) {
                    allMedia = [];
                } else {
                    const response = await fetchMedia( { per_page: totalCount || 1 } );
                    allMedia = response.data;
                }

                const byType: MediaStats['byType'] = {
                    image:    { count: 0, size: 0, sizeFormatted: '' },
                    video:    { count: 0, size: 0, sizeFormatted: '' },
                    audio:    { count: 0, size: 0, sizeFormatted: '' },
                    document: { count: 0, size: 0, sizeFormatted: '' },
                };

                let totalSize = 0;

                for ( const media of allMedia ) {
                    totalSize += media.file_size;

                    if ( media.is_image ) {
                        byType.image.count += 1;
                        byType.image.size  += media.file_size;
                    } else if ( media.is_video ) {
                        byType.video.count += 1;
                        byType.video.size  += media.file_size;
                    } else if ( media.is_audio ) {
                        byType.audio.count += 1;
                        byType.audio.size  += media.file_size;
                    } else {
                        byType.document.count += 1;
                        byType.document.size  += media.file_size;
                    }
                }

                // Format sizes
                for ( const type of Object.keys( byType ) as MediaType[] ) {
                    byType[type].sizeFormatted = formatBytes( byType[type].size );
                }

                // Recent uploads
                const cutoff        = new Date();
                cutoff.setDate( cutoff.getDate() - recentDays );
                const recentUploads = allMedia.filter(
                    ( m ) => m.created_at && new Date( m.created_at ) >= cutoff,
                ).length;

                // Daily upload counts for sparkline (last N days)
                const dailyUploads: number[] = [];
                for ( let d = recentDays - 1; d >= 0; d-- ) {
                    const dayStart = new Date();
                    dayStart.setDate( dayStart.getDate() - d );
                    dayStart.setHours( 0, 0, 0, 0 );

                    const dayEnd = new Date( dayStart );
                    dayEnd.setDate( dayEnd.getDate() + 1 );

                    const count = allMedia.filter(
                        ( m ) =>
                            m.created_at &&
                            new Date( m.created_at ) >= dayStart &&
                            new Date( m.created_at ) < dayEnd,
                    ).length;

                    dailyUploads.push( count );
                }

                setStats( {
                    totalCount:         detailsUnavailable ? totalCount : allMedia.length,
                    totalSize,
                    totalSizeFormatted: detailsUnavailable ? 'N/A' : formatBytes( totalSize ),
                    byType,
                    recentUploads,
                    dailyUploads,
                    detailsUnavailable,
                } );
            } catch {
                // Stats are non-critical; just show empty state
                setStats( null );
            } finally {
                setLoading( false );
            }
        };

        loadStats();
    }, [ recentDays ] );

    if ( loading ) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loading />
            </div>
        );
    }

    if ( ! stats ) {
        return null;
    }

    const typeColors: Record<MediaType, string> = {
        image:    'info',
        video:    'accent',
        audio:    'warning',
        document: 'neutral',
    };

    const totalItems = stats.totalCount || 1;

    return (
        <div className={ cn( 'flex flex-col gap-4', className ) }>
            { /* KPI Stats */ }
            <StatGroup>
                <Stat
                    title="Total Files"
                    value={ stats.totalCount.toLocaleString() }
                    description="All media items"
                />
                <Stat
                    title="Storage Used"
                    value={ stats.totalSizeFormatted }
                    description="Total file size"
                />
                <Stat
                    title={ `Last ${ recentDays } Days` }
                    value={ stats.recentUploads.toLocaleString() }
                    description="Recent uploads"
                />
            </StatGroup>

            { stats.detailsUnavailable && (
                <div className="alert alert-warning">
                    <span>
                        Detailed breakdown is unavailable for libraries with more than 2,000 items.
                        Total file count is shown above.
                    </span>
                </div>
            ) }

            { ! stats.detailsUnavailable && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                { /* Type breakdown */ }
                <Card title="By Type">
                    <div className="flex flex-col gap-3">
                        { ( Object.keys( stats.byType ) as MediaType[] ).map( ( type ) => {
                            const data       = stats.byType[type];
                            const percentage = Math.round( ( data.count / totalItems ) * 100 );

                            return (
                                <div key={ type }>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                value={ type.charAt( 0 ).toUpperCase() + type.slice( 1 ) }
                                                color={ typeColors[type] as import( '@artisanpack-ui/react' ).DaisyColor }
                                            />
                                            <span className="text-sm">{ data.count } files</span>
                                        </div>
                                        <span className="text-xs text-base-content/60">
                                            { data.sizeFormatted }
                                        </span>
                                    </div>
                                    <Progress
                                        value={ percentage }
                                        color={ typeColors[type] as import( '@artisanpack-ui/react' ).DaisyColor }
                                    />
                                </div>
                            );
                        } ) }
                    </div>
                </Card>

                { /* Upload trend */ }
                <Card title="Upload Trend">
                    <div className="h-24">
                        <Sparkline
                            data={ stats.dailyUploads }
                            color="primary"
                        />
                    </div>
                    <p className="text-xs text-base-content/60 mt-2">
                        Daily uploads over the last { recentDays } days
                    </p>
                </Card>
            </div>
            ) }
        </div>
    );
};
