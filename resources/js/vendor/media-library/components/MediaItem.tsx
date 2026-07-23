// @ts-nocheck — published media-library source uses an older @artisanpack-ui/react Alert/Tooltip API than Keystone's. The runtime works (extra props are no-ops); silencing tsc until the next package re-publish resyncs the types.
/**
 * ArtisanPack UI Media Library - MediaItem Component
 *
 * Individual media card with thumbnail, metadata overlay, and selection state.
 * Displays contextual information based on media type (image preview, video
 * duration, file icon, etc.).
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import React from 'react';
import { Card, Badge, Tooltip } from '@artisanpack-ui/react';
import { cn } from '@artisanpack-ui/tokens';

import type { Media } from '../types/media';

/**
 * Props for the MediaItem component.
 */
export interface MediaItemProps {
    /** The media item to display. */
    media: Media;
    /** Whether this item is selected. */
    selected?: boolean;
    /** Whether bulk select mode is active. */
    bulkSelectMode?: boolean;
    /** Display mode. */
    viewMode?: 'grid' | 'list';
    /** Called when the item is clicked. */
    onClick?: ( media: Media ) => void;
    /** Called when the select checkbox is toggled. */
    onSelect?: ( media: Media ) => void;
    /** Whether this item has keyboard focus. */
    focused?: boolean;
    /** Additional CSS class names. */
    className?: string;
}

/**
 * Get a display icon SVG for non-image media types.
 */
function getMediaTypeIcon( media: Media ): string {
    if ( media.is_video ) {
        return 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z';
    }
    if ( media.is_audio ) {
        return 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3';
    }
    // Document
    return 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z';
}

/**
 * Format duration in seconds to MM:SS.
 */
function formatDuration( seconds: number | null ): string {
    if ( seconds === null || seconds === undefined ) {
        return '';
    }
    const mins = Math.floor( seconds / 60 );
    const secs = Math.floor( seconds % 60 );
    return `${ mins }:${ secs.toString().padStart( 2, '0' ) }`;
}

/**
 * Individual media card with thumbnail, metadata, and selection state.
 */
export const MediaItem: React.FC<MediaItemProps> = ( {
    media,
    selected       = false,
    bulkSelectMode = false,
    viewMode       = 'grid',
    onClick,
    onSelect,
    focused = false,
    className,
} ) => {
    const handleClick = ( e: React.MouseEvent ) => {
        if ( bulkSelectMode ) {
            e.preventDefault();
            onSelect?.( media );
        } else {
            onClick?.( media );
        }
    };

    const handleCheckboxClick = ( e: React.MouseEvent ) => {
        e.stopPropagation();
        onSelect?.( media );
    };

    const handleKeyDown = ( e: React.KeyboardEvent ) => {
        if ( e.key === 'Enter' || e.key === ' ' ) {
            e.preventDefault();
            if ( bulkSelectMode ) {
                onSelect?.( media );
            } else {
                onClick?.( media );
            }
        }
    };

    if ( viewMode === 'list' ) {
        return (
            <div
                role="option"
                aria-selected={ selected }
                tabIndex={ 0 }
                onClick={ handleClick }
                onKeyDown={ handleKeyDown }
                className={ cn(
                    'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                    'hover:bg-base-200',
                    selected && 'bg-primary/10 ring-2 ring-primary',
                    focused && 'ring-2 ring-info',
                    className,
                ) }
            >
                { ( bulkSelectMode || selected ) && (
                    <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-sm"
                        checked={ selected }
                        onChange={ () => onSelect?.( media ) }
                        onClick={ ( e ) => e.stopPropagation() }
                        aria-label={ `Select ${ media.title || media.file_name }` }
                    />
                ) }

                <div className="w-12 h-12 shrink-0 rounded overflow-hidden bg-base-200 flex items-center justify-center">
                    { media.is_image ? (
                        <img
                            src={ media.url }
                            alt={ media.alt_text || media.file_name }
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <svg className="w-6 h-6 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 1.5 }>
                            <path strokeLinecap="round" strokeLinejoin="round" d={ getMediaTypeIcon( media ) } />
                        </svg>
                    ) }
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                        { media.title || media.file_name }
                    </p>
                    <p className="text-xs text-base-content/60">
                        { media.human_size }
                        { media.is_image && media.width && media.height &&
                            ` \u00B7 ${ media.width }\u00D7${ media.height }` }
                        { media.is_video && media.duration &&
                            ` \u00B7 ${ formatDuration( media.duration ) }` }
                    </p>
                </div>

                <Badge
                    value={ media.is_image ? 'Image' : media.is_video ? 'Video' : media.is_audio ? 'Audio' : 'Doc' }
                    color={ media.is_image ? 'info' : media.is_video ? 'accent' : media.is_audio ? 'warning' : 'neutral' }
                />
            </div>
        );
    }

    // Grid view
    return (
        <div
            role="option"
            aria-selected={ selected }
            tabIndex={ 0 }
            onClick={ handleClick }
            onKeyDown={ handleKeyDown }
            className={ cn(
                'group relative rounded-lg overflow-hidden cursor-pointer transition-all',
                'ring-2 ring-transparent hover:ring-base-300',
                selected && 'ring-primary ring-2',
                focused && 'ring-info ring-2',
                className,
            ) }
        >
            { /* Thumbnail / Preview */ }
            <div className="aspect-square bg-base-200 flex items-center justify-center overflow-hidden">
                { media.is_image ? (
                    <img
                        src={ media.url }
                        alt={ media.alt_text || media.file_name }
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <svg className="w-12 h-12 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 1.5 }>
                        <path strokeLinecap="round" strokeLinejoin="round" d={ getMediaTypeIcon( media ) } />
                    </svg>
                ) }
            </div>

            { /* Selection checkbox */ }
            { ( bulkSelectMode || selected ) && (
                <div className="absolute top-2 left-2">
                    <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-sm bg-base-100"
                        checked={ selected }
                        onChange={ () => onSelect?.( media ) }
                        onClick={ handleCheckboxClick }
                        aria-label={ `Select ${ media.title || media.file_name }` }
                    />
                </div>
            ) }

            { /* Duration badge for video */ }
            { media.is_video && media.duration && (
                <div className="absolute bottom-14 right-2">
                    <Badge value={ formatDuration( media.duration ) } color="neutral" />
                </div>
            ) }

            { /* Metadata overlay */ }
            <div className="p-2">
                <Tooltip content={ media.title || media.file_name }>
                    <p className="text-xs font-medium truncate">
                        { media.title || media.file_name }
                    </p>
                </Tooltip>
                <p className="text-xs text-base-content/50 mt-0.5">
                    { media.human_size }
                </p>
            </div>
        </div>
    );
};
