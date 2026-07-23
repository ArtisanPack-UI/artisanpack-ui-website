/**
 * React hook for managing user consent preferences.
 *
 * Integrates with the analytics consent API endpoints to check, grant,
 * and revoke consent for tracking categories (analytics, marketing, etc.).
 * Supports GDPR and CCPA compliance modes with localStorage persistence
 * and cookie synchronization.
 *
 * @since 1.1.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ConsentStatusItem, ConsentStatusResponse, ConsentUpdateResponse } from '../../types';

/** Storage keys for consent data. */
const STORAGE_KEY = 'ap_analytics_consent';
const VISITOR_KEY = 'ap_visitor_id';
const VISITOR_COOKIE = '_ap_vid';
const COOKIE_NAME = 'ap_consent';
const COOKIE_EXPIRY_DAYS = 365;

export interface UseConsentOptions {
    /** The API route prefix. Defaults to 'api/analytics'. */
    apiPrefix?: string;
    /** Whether to fetch consent status on mount. Defaults to true. */
    fetchOnMount?: boolean;
    /** Initial categories to populate before any API call. Useful for SSR or demos. */
    initialCategories?: Record<string, ConsentStatusItem>;
    /** Initial consent-required flag. Useful for SSR or demos. */
    initialConsentRequired?: boolean;
}

export interface UseConsentResult {
    /** Whether consent data is currently loading. */
    loading: boolean;
    /** Error message if the last operation failed. */
    error: string | null;
    /** Whether consent is required by the application config. */
    consentRequired: boolean;
    /** Current consent status by category key. */
    categories: Record<string, ConsentStatusItem>;
    /** Check if a specific category has been granted. */
    hasConsent: ( category: string ) => boolean;
    /** Grant consent for the given categories. */
    grantConsent: ( categories: string[] ) => Promise<void>;
    /** Revoke consent for the given categories. */
    revokeConsent: ( categories: string[] ) => Promise<void>;
    /** Accept all consent categories. */
    acceptAll: () => Promise<void>;
    /** Reject all non-required consent categories. */
    rejectAll: () => Promise<void>;
    /** Update consent for specific categories. */
    updateConsent: ( updates: Record<string, boolean> ) => Promise<void>;
    /** Refresh consent status from the server. */
    refresh: () => Promise<void>;
}

/**
 * Set a cookie value with expiry.
 */
function setCookie( name: string, value: string, days: number ): void {
    if ( typeof document === 'undefined' ) {
        return;
    }

    const date = new Date();
    date.setTime( date.getTime() + days * 24 * 60 * 60 * 1000 );
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent( value )}; expires=${date.toUTCString()}; path=/; SameSite=Lax${secure}`;
}

/**
 * Get the CSRF token from the meta tag.
 */
function getCsrfToken(): string {
    if ( typeof document === 'undefined' ) {
        return '';
    }

    return document.querySelector( 'meta[name="csrf-token"]' )?.getAttribute( 'content' ) ?? '';
}

/**
 * Read a cookie value by name.
 */
function getCookie( name: string ): string | null {
    if ( typeof document === 'undefined' ) {
        return null;
    }

    const match = document.cookie.match( new RegExp( `(?:^|; )${name}=([^;]*)` ) );

    return match ? decodeURIComponent( match[ 1 ] ) : null;
}

/**
 * Generate a v4-style UUID.
 */
function generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace( /[xy]/g, ( c ) => {
        const r = ( Math.random() * 16 ) | 0;

        return ( c === 'x' ? r : ( r & 0x3 ) | 0x8 ).toString( 16 );
    } );
}

/**
 * Get or create a visitor ID.
 *
 * Checks localStorage first, then falls back to the tracker cookie (_ap_vid).
 * If neither exists, generates a new UUID and persists it to both localStorage
 * and the visitor cookie so subsequent calls return the same ID.
 */
function getVisitorId(): string | null {
    // Check localStorage first
    try {
        if ( typeof localStorage !== 'undefined' ) {
            const stored = localStorage.getItem( VISITOR_KEY );

            if ( stored ) {
                return stored;
            }
        }
    } catch {
        // localStorage may be blocked (e.g. Safari private browsing)
    }

    // Fall back to the tracker cookie
    const cookieId = getCookie( VISITOR_COOKIE );

    if ( cookieId ) {
        try {
            if ( typeof localStorage !== 'undefined' ) {
                localStorage.setItem( VISITOR_KEY, cookieId );
            }
        } catch {
            // Ignore localStorage write failure
        }

        return cookieId;
    }

    // No existing visitor ID found — return null so callers can decide
    // whether to create one (e.g. only after consent is granted)
    return null;
}

/**
 * Get or create a visitor ID. Only call this when the user has given
 * consent so we don't mint tracker identifiers before consent.
 */
function getOrCreateVisitorId(): string {
    const existing = getVisitorId();

    if ( existing ) {
        return existing;
    }

    const id = generateUuid();
    setCookie( VISITOR_COOKIE, id, COOKIE_EXPIRY_DAYS );

    try {
        if ( typeof localStorage !== 'undefined' ) {
            localStorage.setItem( VISITOR_KEY, id );
        }
    } catch {
        // Ignore localStorage write failure
    }

    return id;
}

/**
 * Read stored consent choices from localStorage or cookie.
 */
function readStoredConsent(): Record<string, boolean> | null {
    let raw: string | null = null;

    try {
        if ( typeof localStorage !== 'undefined' ) {
            raw = localStorage.getItem( STORAGE_KEY );
        }
    } catch {
        // Ignore localStorage read failure
    }

    if ( ! raw ) {
        raw = getCookie( COOKIE_NAME );
    }

    if ( ! raw ) {
        return null;
    }

    try {
        return JSON.parse( raw );
    } catch {
        return null;
    }
}

/**
 * Persist consent categories to localStorage and cookie.
 */
function persistLocally( categories: Record<string, boolean> ): void {
    const value = JSON.stringify( categories );

    setCookie( COOKIE_NAME, value, COOKIE_EXPIRY_DAYS );

    try {
        if ( typeof localStorage !== 'undefined' ) {
            localStorage.setItem( STORAGE_KEY, value );
        }
    } catch {
        // Ignore localStorage write failure
    }
}

/**
 * Hook for managing consent preferences with API integration.
 */
export function useConsent( options: UseConsentOptions = {} ): UseConsentResult {
    const {
        apiPrefix: rawApiPrefix = 'api/analytics',
        fetchOnMount = true,
        initialCategories = {},
        initialConsentRequired = false,
    } = options;

    const trimmed = rawApiPrefix.replace( /^\/+|\/+$/g, '' );
    const apiPrefix = trimmed ? `/${trimmed}` : '';

    const [ loading, setLoading ] = useState( false );
    const [ error, setError ] = useState<string | null>( null );
    const [ consentRequired, setConsentRequired ] = useState( initialConsentRequired );
    const [ categories, setCategories ] = useState<Record<string, ConsentStatusItem>>( () => {
        // Hydrate from stored consent so hasConsent() works before the first
        // API fetch completes (or when fetchOnMount is false)
        const hydrated = { ...initialCategories };
        const stored = readStoredConsent();

        if ( stored ) {
            for ( const [ key, granted ] of Object.entries( stored ) ) {
                if ( hydrated[ key ] ) {
                    hydrated[ key ] = { ...hydrated[ key ], granted };
                }
            }
        }

        return hydrated;
    } );
    const abortRef = useRef<AbortController | null>( null );

    const fetchStatus = useCallback( async (): Promise<void> => {
        const visitorId = getVisitorId();

        if ( ! visitorId ) {
            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading( true );
        setError( null );

        try {
            const response = await fetch(
                `${apiPrefix}/consent?visitor_id=${encodeURIComponent( visitorId )}`,
                {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'same-origin',
                    signal: controller.signal,
                },
            );

            if ( ! response.ok ) {
                throw new Error( `HTTP ${response.status}: ${response.statusText}` );
            }

            const json: ConsentStatusResponse = await response.json();

            if ( ! json.success ) {
                throw new Error( 'Consent status request was not successful' );
            }

            setConsentRequired( json.consent_required );
            setCategories( json.categories ?? {} );
        } catch ( err ) {
            if ( err instanceof DOMException && err.name === 'AbortError' ) {
                return;
            }

            setError( err instanceof Error ? err.message : 'An unexpected error occurred' );
        } finally {
            if ( ! controller.signal.aborted ) {
                setLoading( false );
            }
        }
    }, [ apiPrefix ] );

    const categoriesRef = useRef( categories );
    categoriesRef.current = categories;
    const updateRequestIdRef = useRef( 0 );

    const updateConsent = useCallback( async ( updates: Record<string, boolean> ): Promise<void> => {
        // Cancel any in-flight status fetch so it cannot overwrite the optimistic update
        abortRef.current?.abort();

        // Snapshot current state for optimistic update and rollback
        const prevCategories = categoriesRef.current;
        const prevMergedState = Object.fromEntries(
            Object.entries( prevCategories ).map( ( [ k, v ] ) => [ k, v.granted ] ),
        );

        const nextCategories = { ...prevCategories };

        for ( const [ key, granted ] of Object.entries( updates ) ) {
            if ( nextCategories[ key ] ) {
                nextCategories[ key ] = {
                    ...nextCategories[ key ],
                    granted,
                    granted_at: granted ? new Date().toISOString() : null,
                };
            }
        }

        const mergedState = Object.fromEntries(
            Object.entries( nextCategories ).map( ( [ k, v ] ) => [ k, v.granted ] ),
        );

        // Apply changes optimistically so the UI updates immediately
        categoriesRef.current = nextCategories;
        setCategories( nextCategories );
        persistLocally( mergedState );

        // Sync with server — create a visitor ID if needed since the user
        // is actively giving/revoking consent
        const visitorId = getOrCreateVisitorId();

        const requestId = ++updateRequestIdRef.current;

        setLoading( true );
        setError( null );

        try {
            const response = await fetch( `${apiPrefix}/consent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': getCsrfToken(),
                },
                credentials: 'same-origin',
                body: JSON.stringify( {
                    visitor_id: visitorId,
                    categories: updates,
                } ),
            } );

            if ( ! response.ok ) {
                throw new Error( `HTTP ${response.status}: ${response.statusText}` );
            }

            const json: ConsentUpdateResponse = await response.json();

            if ( ! json.success ) {
                throw new Error( 'Consent update request was not successful' );
            }

            // Only apply server response if this is still the latest request
            if ( requestId === updateRequestIdRef.current ) {
                const serverCategories = json.categories ?? {};
                categoriesRef.current = serverCategories;
                setCategories( serverCategories );

                // Persist server-validated state to keep local storage in sync
                const serverMergedState = Object.fromEntries(
                    Object.entries( serverCategories ).map( ( [ k, v ] ) => [ k, v.granted ] ),
                );
                persistLocally( serverMergedState );
            }
        } catch ( err ) {
            // Only rollback and surface error if this is still the latest request
            if ( requestId === updateRequestIdRef.current ) {
                setError( err instanceof Error ? err.message : 'An unexpected error occurred' );
                categoriesRef.current = prevCategories;
                setCategories( prevCategories );
                persistLocally( prevMergedState );
            }

            throw err;
        } finally {
            if ( requestId === updateRequestIdRef.current ) {
                setLoading( false );
            }
        }
    }, [ apiPrefix ] );

    const hasConsent = useCallback( ( category: string ): boolean => {
        return categories[ category ]?.granted ?? false;
    }, [ categories ] );

    const grantConsent = useCallback( async ( cats: string[] ): Promise<void> => {
        const updates: Record<string, boolean> = {};

        for ( const key of Object.keys( categories ) ) {
            updates[ key ] = categories[ key ].granted;
        }

        for ( const cat of cats ) {
            updates[ cat ] = true;
        }

        await updateConsent( updates );
    }, [ categories, updateConsent ] );

    const revokeConsent = useCallback( async ( cats: string[] ): Promise<void> => {
        const updates: Record<string, boolean> = {};

        for ( const key of Object.keys( categories ) ) {
            updates[ key ] = categories[ key ].granted;
        }

        for ( const cat of cats ) {
            updates[ cat ] = false;
        }

        await updateConsent( updates );
    }, [ categories, updateConsent ] );

    const acceptAll = useCallback( async (): Promise<void> => {
        const updates: Record<string, boolean> = {};

        for ( const key of Object.keys( categories ) ) {
            updates[ key ] = true;
        }

        await updateConsent( updates );
    }, [ categories, updateConsent ] );

    const rejectAll = useCallback( async (): Promise<void> => {
        const updates: Record<string, boolean> = {};

        for ( const key of Object.keys( categories ) ) {
            updates[ key ] = categories[ key ].required;
        }

        await updateConsent( updates );
    }, [ categories, updateConsent ] );

    useEffect( () => {
        if ( fetchOnMount ) {
            fetchStatus();
        }

        return () => {
            abortRef.current?.abort();
        };
    }, [ fetchStatus, fetchOnMount ] );

    return {
        loading,
        error,
        consentRequired,
        categories,
        hasConsent,
        grantConsent,
        revokeConsent,
        acceptAll,
        rejectAll,
        updateConsent,
        refresh: fetchStatus,
    };
}
