/**
 * ArtisanPack UI Media Library - useMediaLibrary Hook
 *
 * Manages media browsing state including search, filtering, sorting,
 * pagination, selection, and bulk actions.
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';

import type {
    Media,
    MediaFilter,
    MediaFolder,
    MediaTag,
    MediaType,
    MediaSortField,
    SortDirection,
    PaginationMeta,
} from '../types/media';

import {
    fetchMedia,
    fetchFolders,
    fetchTags,
    deleteMedia as apiDeleteMedia,
} from '../utils/api';

/**
 * Options for the useMediaLibrary hook.
 */
export interface UseMediaLibraryOptions {
    /** Initial items per page. Defaults to 24. */
    perPage?: number;
    /** Initial sort field. Defaults to 'created_at'. */
    sortBy?: MediaSortField;
    /** Initial sort direction. Defaults to 'desc'. */
    sortOrder?: SortDirection;
    /** Auto-fetch on mount. Defaults to true. */
    autoFetch?: boolean;
}

/**
 * Return value of useMediaLibrary.
 */
export interface UseMediaLibraryReturn {
    /** Current list of media items. */
    media: Media[];
    /** Whether media is currently loading. */
    loading: boolean;
    /** Error message if the last request failed. */
    error: string | null;
    /** Pagination metadata. */
    pagination: PaginationMeta | null;
    /** Available folders. */
    folders: MediaFolder[];
    /** Available tags. */
    tags: MediaTag[];
    /** Current filter state. */
    filters: MediaFilter;
    /** Currently selected media IDs. */
    selectedIds: Set<number>;
    /** Whether bulk select mode is active. */
    bulkSelectMode: boolean;
    /** Current view mode. */
    viewMode: 'grid' | 'list';
    /** Set the search query. */
    setSearch: ( search: string ) => void;
    /** Set the folder filter. */
    setFolderId: ( folderId: number | undefined ) => void;
    /** Set the type filter. */
    setType: ( type: MediaType | undefined ) => void;
    /** Set the tag filter. */
    setTag: ( tag: string | undefined ) => void;
    /** Set sorting. */
    setSort: ( field: MediaSortField, direction?: SortDirection ) => void;
    /** Go to a specific page. */
    goToPage: ( page: number ) => void;
    /** Refresh the current view. */
    refresh: () => Promise<void>;
    /** Toggle selection of a single media item. */
    toggleSelection: ( mediaId: number ) => void;
    /** Select all items on the current page. */
    selectAll: () => void;
    /** Clear all selections. */
    clearSelection: () => void;
    /** Toggle bulk select mode. */
    toggleBulkSelectMode: () => void;
    /** Toggle view mode between grid and list. */
    toggleViewMode: () => void;
    /** Delete selected media items. */
    deleteSelected: () => Promise<void>;
}

/**
 * Hook for managing media library browsing state.
 *
 * Provides search, filtering, sorting, pagination, selection, and
 * bulk actions for the media library.
 */
export function useMediaLibrary( options: UseMediaLibraryOptions = {} ): UseMediaLibraryReturn {
    const {
        perPage   = 24,
        sortBy    = 'created_at',
        sortOrder = 'desc',
        autoFetch = true,
    } = options;

    // Media data
    const [ media, setMedia ]           = useState<Media[]>( [] );
    const [ loading, setLoading ]       = useState( false );
    const [ error, setError ]           = useState<string | null>( null );
    const [ pagination, setPagination ] = useState<PaginationMeta | null>( null );

    // Related data
    const [ folders, setFolders ] = useState<MediaFolder[]>( [] );
    const [ tags, setTags ]       = useState<MediaTag[]>( [] );

    // Filters
    const [ filters, setFilters ] = useState<MediaFilter>( {
        per_page:   perPage,
        sort_by:    sortBy,
        sort_order: sortOrder,
        page:       1,
    } );

    // Selection
    const [ selectedIds, setSelectedIds ]         = useState<Set<number>>( new Set() );
    const [ bulkSelectMode, setBulkSelectMode ]   = useState( false );
    const [ viewMode, setViewMode ]               = useState<'grid' | 'list'>( 'grid' );

    // Track whether this is the initial mount
    const mounted = useRef( false );

    /**
     * Fetch media items using the current filters.
     */
    const loadMedia = useCallback( async ( currentFilters: MediaFilter ) => {
        setLoading( true );
        setError( null );

        try {
            const response = await fetchMedia( currentFilters );
            setMedia( response.data );
            setPagination( response.meta );
        } catch ( err ) {
            setError( err instanceof Error ? err.message : 'Failed to load media' );
        } finally {
            setLoading( false );
        }
    }, [] );

    /**
     * Load folders and tags.
     */
    const loadRelatedData = useCallback( async () => {
        try {
            const [ foldersResponse, tagsResponse ] = await Promise.all( [
                fetchFolders(),
                fetchTags(),
            ] );
            setFolders( foldersResponse.data );
            setTags( tagsResponse.data );
        } catch {
            // Non-critical; silently ignore
        }
    }, [] );

    // Auto-fetch on mount + refetch when filters change
    useEffect( () => {
        if ( ! mounted.current ) {
            mounted.current = true;
            if ( autoFetch ) {
                loadMedia( filters );
                loadRelatedData();
            }
            return;
        }

        loadMedia( filters );
    }, [ autoFetch, filters, loadMedia, loadRelatedData ] );

    /**
     * Update filters and reset to page 1.
     */
    const updateFilter = useCallback( ( patch: Partial<MediaFilter> ) => {
        setFilters( ( prev ) => ( { ...prev, ...patch, page: 1 } ) );
    }, [] );

    const setSearch   = useCallback( ( search: string ) => updateFilter( { search } ), [ updateFilter ] );
    const setFolderId = useCallback( ( folderId: number | undefined ) => updateFilter( { folder_id: folderId } ), [ updateFilter ] );
    const setType     = useCallback( ( type: MediaType | undefined ) => updateFilter( { type } ), [ updateFilter ] );
    const setTag      = useCallback( ( tag: string | undefined ) => updateFilter( { tag } ), [ updateFilter ] );

    const setSort = useCallback( ( field: MediaSortField, direction?: SortDirection ) => {
        setFilters( ( prev ) => ( {
            ...prev,
            sort_by:    field,
            sort_order: direction ?? ( prev.sort_by === field && prev.sort_order === 'asc' ? 'desc' : 'asc' ),
            page:       1,
        } ) );
    }, [] );

    const goToPage = useCallback( ( page: number ) => {
        setFilters( ( prev ) => ( { ...prev, page } ) );
    }, [] );

    const refresh = useCallback( async () => {
        await Promise.all( [
            loadMedia( filters ),
            loadRelatedData(),
        ] );
    }, [ filters, loadMedia, loadRelatedData ] );

    // Selection handlers
    const toggleSelection = useCallback( ( mediaId: number ) => {
        setSelectedIds( ( prev ) => {
            const next = new Set( prev );
            if ( next.has( mediaId ) ) {
                next.delete( mediaId );
            } else {
                next.add( mediaId );
            }
            return next;
        } );
    }, [] );

    const selectAll = useCallback( () => {
        setSelectedIds( new Set( media.map( ( m ) => m.id ) ) );
    }, [ media ] );

    const clearSelection = useCallback( () => {
        setSelectedIds( new Set() );
    }, [] );

    const toggleBulkSelectMode = useCallback( () => {
        setBulkSelectMode( ( prev ) => {
            if ( prev ) {
                setSelectedIds( new Set() );
            }
            return ! prev;
        } );
    }, [] );

    const toggleViewMode = useCallback( () => {
        setViewMode( ( prev ) => ( prev === 'grid' ? 'list' : 'grid' ) );
    }, [] );

    const deleteSelected = useCallback( async () => {
        if ( selectedIds.size === 0 ) {
            return;
        }

        setLoading( true );
        setError( null );

        try {
            await Promise.all(
                Array.from( selectedIds ).map( ( id ) => apiDeleteMedia( id ) ),
            );
            setSelectedIds( new Set() );
            await loadMedia( filters );
        } catch ( err ) {
            setError( err instanceof Error ? err.message : 'Failed to delete media' );
        } finally {
            setLoading( false );
        }
    }, [ selectedIds, filters, loadMedia ] );

    return {
        media,
        loading,
        error,
        pagination,
        folders,
        tags,
        filters,
        selectedIds,
        bulkSelectMode,
        viewMode,
        setSearch,
        setFolderId,
        setType,
        setTag,
        setSort,
        goToPage,
        refresh,
        toggleSelection,
        selectAll,
        clearSelection,
        toggleBulkSelectMode,
        toggleViewMode,
        deleteSelected,
    };
}
