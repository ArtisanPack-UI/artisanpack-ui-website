/**
 * React hook for fetching data from the analytics API endpoints.
 *
 * Provides a generic fetch wrapper that handles loading states, error
 * handling, request cancellation, and optional polling for realtime data.
 *
 * @since 1.1.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { AnalyticsQueryParams, RealtimeQueryParams } from '../../types';

interface UseAnalyticsApiOptions<T> {
    /** The API endpoint path relative to the analytics route prefix. */
    endpoint: string;
    /** Query parameters to include in the request. */
    params?: AnalyticsQueryParams | RealtimeQueryParams;
    /** Polling interval in milliseconds. Set to 0 to disable. */
    pollInterval?: number;
    /** Initial data to use before the first fetch completes. */
    initialData?: T;
    /** Whether to fetch on mount. Defaults to true. */
    fetchOnMount?: boolean;
}

interface UseAnalyticsApiResult<T> {
    data: T | undefined;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

/**
 * Build a query string from an object of parameters.
 */
function buildQueryString( params: Record<string, unknown> ): string {
    const parts: string[] = [];

    for ( const [ key, value ] of Object.entries( params ) ) {
        if ( value !== undefined && value !== null && value !== '' ) {
            parts.push( `${encodeURIComponent( key )}=${encodeURIComponent( String( value ) )}` );
        }
    }

    return parts.length > 0 ? `?${parts.join( '&' )}` : '';
}

/**
 * Hook for fetching analytics API data with optional polling.
 */
export function useAnalyticsApi<T>(
    options: UseAnalyticsApiOptions<T>,
): UseAnalyticsApiResult<T> {
    const {
        endpoint,
        params = {},
        pollInterval = 0,
        initialData,
        fetchOnMount = true,
    } = options;

    const [ data, setData ] = useState<T | undefined>( initialData );
    const [ loading, setLoading ] = useState( fetchOnMount );
    const [ error, setError ] = useState<string | null>( null );
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>( null );
    const abortRef = useRef<AbortController | null>( null );

    const fetchData = useCallback( async (): Promise<void> => {
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading( true );
        setError( null );

        try {
            const queryString = buildQueryString( params as Record<string, unknown> );
            const response = await fetch( `/api/analytics/${endpoint}${queryString}`, {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                signal: controller.signal,
            } );

            if ( ! response.ok ) {
                throw new Error( `HTTP ${response.status}: ${response.statusText}` );
            }

            const json = await response.json();
            setData( json.data ?? json );
        } catch ( err ) {
            if ( err instanceof DOMException && err.name === 'AbortError' ) {
                return;
            }

            const message = err instanceof Error ? err.message : 'An unexpected error occurred';
            setError( message );
        } finally {
            if ( ! controller.signal.aborted ) {
                setLoading( false );
            }
        }
    }, [ endpoint, JSON.stringify( params ) ] );

    useEffect( () => {
        if ( fetchOnMount ) {
            fetchData();
        }

        return () => {
            abortRef.current?.abort();
        };
    }, [ fetchData, fetchOnMount ] );

    useEffect( () => {
        if ( pollInterval > 0 ) {
            intervalRef.current = setInterval( fetchData, pollInterval );
        }

        return () => {
            if ( intervalRef.current ) {
                clearInterval( intervalRef.current );
            }
        };
    }, [ fetchData, pollInterval ] );

    return { data, loading, error, refresh: fetchData };
}
