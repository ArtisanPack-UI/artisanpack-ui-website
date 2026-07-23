/**
 * ArtisanPack UI Media Library - API Client
 *
 * Provides typed API functions for communicating with the media library
 * REST endpoints. All requests include XSRF token handling for Laravel
 * Sanctum authentication.
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import type {
    Media,
    MediaFilter,
    MediaListResponse,
    MediaUploadResponse,
    MediaShowResponse,
    MediaUpdatePayload,
    MediaFolder,
    MediaTag,
    FolderListResponse,
    TagListResponse,
    MediaConfigResponse,
} from '../types/media';

/**
 * Optional Bearer token for Sanctum token-based authentication.
 * Set via `configureAuth()` for apps that pass a token from the server.
 * When unset the client falls back to cookie/XSRF-based SPA auth.
 */
let bearerToken: string | null = null;

/**
 * Configure the API client with a Sanctum Bearer token.
 * Call once at app initialisation (e.g. read from a data attribute).
 */
export function configureAuth( token: string ): void {
    bearerToken = token;
}

/**
 * Read the XSRF token from cookies for Sanctum SPA authentication.
 */
function getXsrfToken(): string | null {
    const match = document.cookie.match( /XSRF-TOKEN=([^;]+)/ );
    return match ? decodeURIComponent( match[1] ) : null;
}

/**
 * Ensure the Sanctum CSRF cookie is set before making authenticated
 * API requests. Only fetches the cookie once per page load.
 * Skipped when a Bearer token is configured.
 */
let csrfInitialized = false;
let csrfPromise: Promise<void> | null = null;

async function ensureCsrfCookie(): Promise<void> {
    if ( bearerToken ) {
        return;
    }

    if ( csrfInitialized && getXsrfToken() ) {
        return;
    }

    if ( ! csrfPromise ) {
        csrfPromise = fetch( '/sanctum/csrf-cookie', {
            credentials: 'include',
        } ).then( () => {
            csrfInitialized = true;
        } ).catch( ( err ) => {
            csrfPromise = null;
            throw err;
        } );
    }

    await csrfPromise;
}

/**
 * Build default headers for API requests.
 * When `isFormData` is true the Content-Type header is omitted so
 * the browser can set the correct multipart boundary automatically.
 */
function buildHeaders( isFormData = false ): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };

    if ( ! isFormData ) {
        headers['Content-Type'] = 'application/json';
    }

    if ( bearerToken ) {
        headers.Authorization = `Bearer ${ bearerToken }`;
    } else {
        const xsrfToken = getXsrfToken();
        if ( xsrfToken ) {
            headers['X-XSRF-TOKEN'] = xsrfToken;
        }
    }

    return headers;
}

/**
 * Execute a fetch request and parse the JSON response.
 * Uses Bearer token auth when configured, otherwise falls back
 * to Sanctum SPA cookie authentication.
 *
 * @param isFormData Pass `true` when sending FormData so Content-Type is omitted.
 * @throws {Error} If the response is not ok.
 */
async function apiFetch<T>(
    url: string,
    options: RequestInit = {},
    isFormData = false,
): Promise<T> {
    await ensureCsrfCookie();

    const defaultHeaders = buildHeaders( isFormData );
    const customHeaders  = ( options.headers ?? {} ) as Record<string, string>;

    const response = await fetch( url, {
        credentials: 'include',
        ...options,
        headers: { ...defaultHeaders, ...customHeaders },
    } );

    if ( ! response.ok ) {
        const body = await response.json().catch( () => ( {} ) );
        const message = body.message || `API error: ${ response.status }`;
        throw new Error( message );
    }

    // Handle empty responses (e.g. 204 No Content)
    const text = await response.text();
    if ( ! text ) {
        return null as T;
    }

    return JSON.parse( text );
}

/**
 * Build query string from MediaFilter parameters.
 */
function buildQueryString( params: Record<string, unknown> ): string {
    const searchParams = new URLSearchParams();

    for ( const [ key, value ] of Object.entries( params ) ) {
        if ( value !== undefined && value !== null && value !== '' ) {
            searchParams.set( key, String( value ) );
        }
    }

    const queryString = searchParams.toString();
    return queryString ? `?${ queryString }` : '';
}

// =============================================================================
// Media Endpoints
// =============================================================================

/**
 * Fetch the server-side upload configuration.
 */
export async function fetchMediaConfig(): Promise<MediaConfigResponse> {
    return apiFetch<MediaConfigResponse>( '/api/media/config' );
}

/**
 * List media items with optional filters and pagination.
 */
export async function fetchMedia( filters: MediaFilter = {} ): Promise<MediaListResponse> {
    const query = buildQueryString( filters as Record<string, unknown> );

    return apiFetch<MediaListResponse>( `/api/media${ query }` );
}

/**
 * Get a single media item by ID.
 */
export async function fetchMediaById( id: number ): Promise<MediaShowResponse> {
    return apiFetch<MediaShowResponse>( `/api/media/${ id }` );
}

/**
 * Upload a media file with optional metadata.
 *
 * @param file     The file to upload.
 * @param metadata Optional metadata (title, alt_text, folder_id, etc.).
 * @param onProgress Optional callback for upload progress (0-100).
 */
export async function uploadMedia(
    file: File,
    metadata: Record<string, string | number | number[]> = {},
    onProgress?: ( percent: number ) => void,
): Promise<MediaUploadResponse> {
    const formData = new FormData();
    formData.append( 'file', file );

    for ( const [ key, value ] of Object.entries( metadata ) ) {
        if ( Array.isArray( value ) ) {
            for ( const item of value ) {
                formData.append( `${ key }[]`, String( item ) );
            }
        } else if ( value !== undefined && value !== null ) {
            formData.append( key, String( value ) );
        }
    }

    if ( onProgress ) {
        // Use XMLHttpRequest for progress tracking
        await ensureCsrfCookie();

        return new Promise( ( resolve, reject ) => {
            const xhr = new XMLHttpRequest();
            xhr.open( 'POST', '/api/media' );
            xhr.withCredentials = true;

            if ( bearerToken ) {
                xhr.setRequestHeader( 'Authorization', `Bearer ${ bearerToken }` );
            } else {
                const xsrfToken = getXsrfToken();
                if ( xsrfToken ) {
                    xhr.setRequestHeader( 'X-XSRF-TOKEN', xsrfToken );
                }
            }
            xhr.setRequestHeader( 'Accept', 'application/json' );

            xhr.upload.addEventListener( 'progress', ( event ) => {
                if ( event.lengthComputable ) {
                    onProgress( Math.round( ( event.loaded / event.total ) * 100 ) );
                }
            } );

            xhr.addEventListener( 'load', () => {
                if ( xhr.status >= 200 && xhr.status < 300 ) {
                    try {
                        resolve( JSON.parse( xhr.responseText ) );
                    } catch {
                        reject( new Error( 'Invalid JSON response from server' ) );
                    }
                } else {
                    let message = `Upload failed: ${ xhr.status }`;
                    try {
                        const body = JSON.parse( xhr.responseText );
                        if ( body.message ) {
                            message = body.message;
                        }
                    } catch {
                        // Non-JSON error response; keep default message
                    }
                    reject( new Error( message ) );
                }
            } );

            xhr.addEventListener( 'error', () => reject( new Error( 'Upload failed' ) ) );
            xhr.send( formData );
        } );
    }

    return apiFetch<MediaUploadResponse>(
        '/api/media',
        { method: 'POST', body: formData },
        true,
    );
}

/**
 * Update a media item's metadata.
 */
export async function updateMedia( id: number, payload: MediaUpdatePayload ): Promise<MediaShowResponse> {
    return apiFetch<MediaShowResponse>( `/api/media/${ id }`, {
        method: 'PUT',
        body: JSON.stringify( payload ),
    } );
}

/**
 * Delete a media item.
 */
export async function deleteMedia( id: number ): Promise<void> {
    await apiFetch<void>( `/api/media/${ id }`, {
        method: 'DELETE',
    } );
}

// =============================================================================
// Folder Endpoints
// =============================================================================

/**
 * List all folders.
 */
export async function fetchFolders(): Promise<FolderListResponse> {
    return apiFetch<FolderListResponse>( '/api/media/folders' );
}

/**
 * Create a new folder.
 */
export async function createFolder(
    data: { name: string; slug?: string; description?: string; parent_id?: number | null },
): Promise<{ data: MediaFolder }> {
    return apiFetch<{ data: MediaFolder }>( '/api/media/folders', {
        method: 'POST',
        body: JSON.stringify( data ),
    } );
}

/**
 * Update a folder.
 */
export async function updateFolder(
    id: number,
    data: { name?: string; slug?: string; description?: string; parent_id?: number | null },
): Promise<{ data: MediaFolder }> {
    return apiFetch<{ data: MediaFolder }>( `/api/media/folders/${ id }`, {
        method: 'PUT',
        body: JSON.stringify( data ),
    } );
}

/**
 * Delete a folder.
 */
export async function deleteFolder( id: number ): Promise<void> {
    await apiFetch<void>( `/api/media/folders/${ id }`, {
        method: 'DELETE',
    } );
}

/**
 * Move a folder to a new parent.
 */
export async function moveFolder( id: number, parentId: number | null ): Promise<{ data: MediaFolder }> {
    return apiFetch<{ data: MediaFolder }>( `/api/media/folders/${ id }/move`, {
        method: 'POST',
        body: JSON.stringify( { parent_id: parentId } ),
    } );
}

// =============================================================================
// Tag Endpoints
// =============================================================================

/**
 * List all tags.
 */
export async function fetchTags(): Promise<TagListResponse> {
    return apiFetch<TagListResponse>( '/api/media/tags' );
}

/**
 * Create a new tag.
 */
export async function createTag(
    data: { name: string; slug?: string; description?: string },
): Promise<{ data: MediaTag }> {
    return apiFetch<{ data: MediaTag }>( '/api/media/tags', {
        method: 'POST',
        body: JSON.stringify( data ),
    } );
}

/**
 * Update a tag.
 */
export async function updateTag(
    id: number,
    data: { name?: string; slug?: string; description?: string },
): Promise<{ data: MediaTag }> {
    return apiFetch<{ data: MediaTag }>( `/api/media/tags/${ id }`, {
        method: 'PUT',
        body: JSON.stringify( data ),
    } );
}

/**
 * Delete a tag.
 */
export async function deleteTag( id: number ): Promise<void> {
    await apiFetch<void>( `/api/media/tags/${ id }`, {
        method: 'DELETE',
    } );
}

/**
 * Attach a tag to media items.
 */
export async function attachTag( tagId: number, mediaIds: number[] ): Promise<void> {
    await apiFetch<void>( `/api/media/tags/${ tagId }/attach`, {
        method: 'POST',
        body: JSON.stringify( { media_ids: mediaIds } ),
    } );
}

/**
 * Detach a tag from media items.
 */
export async function detachTag( tagId: number, mediaIds: number[] ): Promise<void> {
    await apiFetch<void>( `/api/media/tags/${ tagId }/detach`, {
        method: 'POST',
        body: JSON.stringify( { media_ids: mediaIds } ),
    } );
}
