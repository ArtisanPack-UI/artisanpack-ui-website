/**
 * ArtisanPack UI Media Library - useMediaPicker Hook
 *
 * Manages picker state for single/multi-select media workflows,
 * including recently used tracking and keyboard navigation.
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';

import type {
    Media,
    MediaType,
    MediaFilter,
    PaginationMeta,
} from '../types/media';

import { fetchMedia } from '../utils/api';

/**
 * Options for the useMediaPicker hook.
 */
export interface UseMediaPickerOptions {
    /** Whether multiple items can be selected. Defaults to false. */
    multiSelect?: boolean;
    /** Maximum number of selections in multi-select mode. */
    maxSelections?: number;
    /** Filter to specific media types. */
    allowedTypes?: MediaType[];
    /** Context identifier for distinguishing multiple pickers. */
    context?: string;
    /** Items per page for browsing. Defaults to 24. */
    perPage?: number;
    /** Called when selection is confirmed. */
    onSelect?: ( media: Media[], context: string ) => void;
}

/**
 * Return value of useMediaPicker.
 */
export interface UseMediaPickerReturn {
    /** Available media items for selection. */
    media: Media[];
    /** Whether media is loading. */
    loading: boolean;
    /** Error message if loading failed. */
    error: string | null;
    /** Pagination metadata. */
    pagination: PaginationMeta | null;
    /** Currently selected media items. */
    selectedMedia: Media[];
    /** Index of the currently focused item (for keyboard nav). */
    focusedIndex: number;
    /** Search query. */
    search: string;
    /** Current folder filter. */
    folderId: number | undefined;
    /** Current type filter. */
    typeFilter: MediaType | undefined;
    /** Recently used media items. */
    recentlyUsed: Media[];
    /** Set the search query. */
    setSearch: ( search: string ) => void;
    /** Set the folder filter. */
    setFolderId: ( folderId: number | undefined ) => void;
    /** Set the type filter. */
    setTypeFilter: ( type: MediaType | undefined ) => void;
    /** Toggle selection of a media item. */
    toggleSelect: ( media: Media ) => void;
    /** Confirm the current selection (calls onSelect). */
    confirmSelection: () => void;
    /** Clear all selections. */
    clearSelection: () => void;
    /** Load a specific page. */
    goToPage: ( page: number ) => void;
    /** Refresh the media list. */
    refresh: () => Promise<void>;
    /** Move focus to the next item. */
    focusNext: () => void;
    /** Move focus to the previous item. */
    focusPrevious: () => void;
    /** Select the currently focused item. */
    selectFocused: () => void;
}

const RECENTLY_USED_KEY = 'artisanpack-media-recently-used';
const MAX_RECENT_ITEMS  = 10;

/**
 * Load recently used media IDs from session storage.
 */
function loadRecentIds(): number[] {
    try {
        const stored = sessionStorage.getItem( RECENTLY_USED_KEY );
        if ( ! stored ) {
            return [];
        }
        const parsed: unknown = JSON.parse( stored );
        if ( Array.isArray( parsed ) && parsed.every( ( item ) => typeof item === 'number' ) ) {
            return parsed as number[];
        }
        return [];
    } catch {
        return [];
    }
}

/**
 * Save recently used media IDs to session storage.
 */
function saveRecentIds( ids: number[] ): void {
    try {
        sessionStorage.setItem( RECENTLY_USED_KEY, JSON.stringify( ids.slice( 0, MAX_RECENT_ITEMS ) ) );
    } catch {
        // Session storage not available
    }
}

/**
 * Hook for managing media picker state.
 *
 * Provides single/multi-select workflows, search, filtering,
 * keyboard navigation, and recently used tracking.
 */
export function useMediaPicker( options: UseMediaPickerOptions = {} ): UseMediaPickerReturn {
    const {
        multiSelect   = false,
        maxSelections,
        allowedTypes,
        context     = 'default',
        perPage     = 24,
        onSelect,
    } = options;

    const [ media, setMedia ]             = useState<Media[]>( [] );
    const [ loading, setLoading ]         = useState( false );
    const [ error, setError ]             = useState<string | null>( null );
    const [ pagination, setPagination ]   = useState<PaginationMeta | null>( null );
    const [ selectedMedia, setSelected ]  = useState<Media[]>( [] );
    const [ focusedIndex, setFocused ]    = useState( -1 );
    const [ search, setSearchState ]      = useState( '' );
    const [ folderId, setFolderIdState ]  = useState<number | undefined>();
    const [ typeFilter, setTypeState ]    = useState<MediaType | undefined>();
    const [ recentlyUsed, setRecent ]     = useState<Media[]>( [] );

    const optionsRef   = useRef( options );
    optionsRef.current = options;

    const filtersRef = useRef<MediaFilter>( {
        per_page:   perPage,
        sort_by:    'created_at',
        sort_order: 'desc',
        page:       1,
    } );

    /**
     * Fetch media with the current filters.
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
     * Build filters from current state.
     */
    const buildFilters = useCallback( (): MediaFilter => {
        const filters: MediaFilter = {
            ...filtersRef.current,
            search:    search || undefined,
            folder_id: folderId,
        };

        // Apply type filter (from prop or state)
        const activeType = typeFilter ?? ( allowedTypes?.length === 1 ? allowedTypes[0] : undefined );
        if ( activeType ) {
            filters.type = activeType;
        }

        return filters;
    }, [ search, folderId, typeFilter, allowedTypes ] );

    // Initial load
    useEffect( () => {
        const filters = buildFilters();
        loadMedia( filters );
    }, [ buildFilters, loadMedia ] );

    // Load recently used
    useEffect( () => {
        const recentIds = loadRecentIds();
        if ( recentIds.length > 0 ) {
            // Fetch recent items from the already-loaded media or make a separate call
            fetchMedia( { per_page: MAX_RECENT_ITEMS } )
                .then( ( response ) => {
                    const recent = response.data.filter( ( m ) => recentIds.includes( m.id ) );
                    setRecent( recent );
                } )
                .catch( () => { /* non-critical */ } );
        }
    }, [] );

    const setSearch = useCallback( ( value: string ) => {
        setSearchState( value );
        filtersRef.current = { ...filtersRef.current, page: 1 };
    }, [] );

    const setFolderId = useCallback( ( value: number | undefined ) => {
        setFolderIdState( value );
        filtersRef.current = { ...filtersRef.current, page: 1 };
    }, [] );

    const setTypeFilter = useCallback( ( value: MediaType | undefined ) => {
        setTypeState( value );
        filtersRef.current = { ...filtersRef.current, page: 1 };
    }, [] );

    const toggleSelect = useCallback( ( item: Media ) => {
        setSelected( ( prev ) => {
            const isSelected = prev.some( ( m ) => m.id === item.id );

            if ( isSelected ) {
                return prev.filter( ( m ) => m.id !== item.id );
            }

            if ( ! multiSelect ) {
                return [ item ];
            }

            if ( maxSelections && prev.length >= maxSelections ) {
                return prev;
            }

            return [ ...prev, item ];
        } );
    }, [ multiSelect, maxSelections ] );

    const confirmSelection = useCallback( () => {
        if ( selectedMedia.length === 0 ) {
            return;
        }

        // Track recently used
        const recentIds = loadRecentIds();
        const newIds    = selectedMedia.map( ( m ) => m.id );
        const merged    = [ ...new Set( [ ...newIds, ...recentIds ] ) ];
        saveRecentIds( merged );

        optionsRef.current.onSelect?.( selectedMedia, context );
    }, [ selectedMedia, context ] );

    const clearSelection = useCallback( () => {
        setSelected( [] );
    }, [] );

    const goToPage = useCallback( ( page: number ) => {
        filtersRef.current = { ...filtersRef.current, page };
        loadMedia( { ...buildFilters(), page } );
    }, [ buildFilters, loadMedia ] );

    const refresh = useCallback( async () => {
        await loadMedia( buildFilters() );
    }, [ buildFilters, loadMedia ] );

    // Keyboard navigation
    const focusNext = useCallback( () => {
        setFocused( ( prev ) => ( prev < media.length - 1 ? prev + 1 : 0 ) );
    }, [ media.length ] );

    const focusPrevious = useCallback( () => {
        setFocused( ( prev ) => ( prev > 0 ? prev - 1 : media.length - 1 ) );
    }, [ media.length ] );

    const selectFocused = useCallback( () => {
        if ( focusedIndex >= 0 && focusedIndex < media.length ) {
            toggleSelect( media[focusedIndex] );
        }
    }, [ focusedIndex, media, toggleSelect ] );

    return {
        media,
        loading,
        error,
        pagination,
        selectedMedia,
        focusedIndex,
        search,
        folderId,
        typeFilter,
        recentlyUsed,
        setSearch,
        setFolderId,
        setTypeFilter,
        toggleSelect,
        confirmSelection,
        clearSelection,
        goToPage,
        refresh,
        focusNext,
        focusPrevious,
        selectFocused,
    };
}
