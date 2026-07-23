/**
 * Vue composable for fetching data from the analytics API endpoints.
 *
 * Provides a generic fetch wrapper that handles loading states, error
 * handling, request cancellation, and optional polling for realtime data.
 *
 * @since 1.1.0
 */

import { onUnmounted, ref, watch, type Ref } from 'vue';

import type { AnalyticsQueryParams, RealtimeQueryParams } from '../../types';

interface UseAnalyticsApiOptions {
    /** The API endpoint path relative to the analytics route prefix. */
    endpoint: string;
    /** Query parameters to include in the request. */
    params?: AnalyticsQueryParams | RealtimeQueryParams;
    /** Polling interval in milliseconds. Set to 0 to disable. */
    pollInterval?: number;
    /** Whether to fetch on mount. Defaults to true. */
    fetchOnMount?: boolean;
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
 * Composable for fetching analytics API data with optional polling.
 */
export function useAnalyticsApi<T>( options: UseAnalyticsApiOptions ) {
    const {
        endpoint,
        params = {},
        pollInterval = 0,
        fetchOnMount = true,
    } = options;

    const data = ref<T | undefined>() as Ref<T | undefined>;
    const loading = ref( fetchOnMount );
    const error = ref<string | null>( null );

    let abortController: AbortController | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let inFlight = false;

    async function fetchData( force = false ): Promise<void> {
        if ( inFlight && ! force ) {
            return;
        }

        if ( force ) {
            abortController?.abort();
        }

        const controller = new AbortController();
        abortController = controller;
        inFlight = true;

        loading.value = true;
        error.value = null;

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
            data.value = json.data ?? json;
        } catch ( err ) {
            if ( err instanceof DOMException && err.name === 'AbortError' ) {
                return;
            }

            error.value = err instanceof Error ? err.message : 'An unexpected error occurred';
        } finally {
            if ( abortController === controller ) {
                inFlight = false;
            }

            if ( ! controller.signal.aborted ) {
                loading.value = false;
            }
        }
    }

    function refresh(): Promise<void> {
        return fetchData( true );
    }

    if ( fetchOnMount ) {
        fetchData();
    }

    if ( pollInterval > 0 ) {
        intervalId = setInterval( fetchData, pollInterval );
    }

    onUnmounted( () => {
        abortController?.abort();

        if ( intervalId ) {
            clearInterval( intervalId );
        }
    } );

    return { data, loading, error, refresh };
}
