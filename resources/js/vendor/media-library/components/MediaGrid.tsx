/**
 * ArtisanPack UI Media Library - MediaGrid Component
 *
 * Responsive grid display for media items with support for grid/list
 * view modes, selection, and pagination.
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import React from 'react';
import { Grid, Pagination, EmptyState, Loading } from '@artisanpack-ui/react';

import type { Media, PaginationMeta } from '../types/media';

import { MediaItem } from './MediaItem';

/**
 * Props for the MediaGrid component.
 */
export interface MediaGridProps {
    /** Array of media items to display. */
    media: Media[];
    /** Whether items are loading. */
    loading?: boolean;
    /** Current view mode. */
    viewMode?: 'grid' | 'list';
    /** Whether bulk select mode is active. */
    bulkSelectMode?: boolean;
    /** Set of selected media IDs. */
    selectedIds?: Set<number>;
    /** Index of the currently focused item. */
    focusedIndex?: number;
    /** Pagination metadata. */
    pagination?: PaginationMeta | null;
    /** Called when a media item is clicked. */
    onItemClick?: ( media: Media ) => void;
    /** Called when a media item's selection is toggled. */
    onItemSelect?: ( media: Media ) => void;
    /** Called when page changes. */
    onPageChange?: ( page: number ) => void;
    /** Additional CSS class names. */
    className?: string;
}

/**
 * Responsive grid/list display for media items.
 */
export const MediaGrid: React.FC<MediaGridProps> = ( {
    media,
    loading        = false,
    viewMode       = 'grid',
    bulkSelectMode = false,
    selectedIds    = new Set(),
    focusedIndex   = -1,
    pagination,
    onItemClick,
    onItemSelect,
    onPageChange,
    className,
} ) => {
    if ( loading ) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loading />
            </div>
        );
    }

    if ( media.length === 0 ) {
        return (
            <EmptyState
                heading="No media found"
                description="Try adjusting your filters or upload new media."
            />
        );
    }

    return (
        <div className={ className }>
            { viewMode === 'grid' ? (
                <Grid cols={ 2 } colsSm={ 3 } colsMd={ 4 } colsLg={ 6 } gap={ 4 } role="listbox" aria-label="Media items">
                    { media.map( ( item, index ) => (
                        <MediaItem
                            key={ item.id }
                            media={ item }
                            selected={ selectedIds.has( item.id ) }
                            bulkSelectMode={ bulkSelectMode }
                            viewMode="grid"
                            focused={ index === focusedIndex }
                            onClick={ onItemClick }
                            onSelect={ onItemSelect }
                        />
                    ) ) }
                </Grid>
            ) : (
                <div className="flex flex-col gap-1" role="listbox" aria-label="Media items">
                    { media.map( ( item, index ) => (
                        <MediaItem
                            key={ item.id }
                            media={ item }
                            selected={ selectedIds.has( item.id ) }
                            bulkSelectMode={ bulkSelectMode }
                            viewMode="list"
                            focused={ index === focusedIndex }
                            onClick={ onItemClick }
                            onSelect={ onItemSelect }
                        />
                    ) ) }
                </div>
            ) }

            { pagination && pagination.last_page > 1 && onPageChange && (
                <div className="mt-6 flex justify-center">
                    <Pagination
                        currentPage={ pagination.current_page }
                        totalPages={ pagination.last_page }
                        onChange={ onPageChange }
                    />
                </div>
            ) }
        </div>
    );
};
