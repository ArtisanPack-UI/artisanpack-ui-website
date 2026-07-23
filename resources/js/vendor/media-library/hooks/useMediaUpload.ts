/**
 * ArtisanPack UI Media Library - useMediaUpload Hook
 *
 * Manages file upload state including drag-and-drop, upload progress,
 * file validation, and queue management.
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';

import type {
    Media,
    MediaConfigResponse,
} from '../types/media';

import { uploadMedia, fetchMediaConfig } from '../utils/api';

/**
 * Represents a file in the upload queue.
 */
export interface UploadQueueItem {
    /** Unique identifier for this queue item. */
    id: string;
    /** The file to upload. */
    file: File;
    /** Upload progress percentage (0-100). */
    progress: number;
    /** Upload status. */
    status: 'pending' | 'uploading' | 'complete' | 'error';
    /** Error message if upload failed. */
    error: string | null;
    /** The uploaded media item (available when complete). */
    media: Media | null;
}

/**
 * Options for the useMediaUpload hook.
 */
export interface UseMediaUploadOptions {
    /** Folder ID to upload into. */
    folderId?: number;
    /** Tag IDs to attach to uploaded files. */
    tagIds?: number[];
    /** Called when a file is uploaded successfully. */
    onUploadComplete?: ( media: Media ) => void;
    /** Called when all files in the queue are processed. */
    onQueueComplete?: ( results: Media[] ) => void;
    /** Auto-fetch config from server on mount. Defaults to true. */
    autoFetchConfig?: boolean;
}

/**
 * Return value of useMediaUpload.
 */
export interface UseMediaUploadReturn {
    /** Current upload queue. */
    queue: UploadQueueItem[];
    /** Whether any file is currently uploading. */
    isUploading: boolean;
    /** Whether the user is dragging files over the drop zone. */
    isDragging: boolean;
    /** Server upload configuration. */
    config: MediaConfigResponse | null;
    /** Validation errors from the last file selection. */
    validationErrors: string[];
    /** Successfully uploaded media items. */
    uploadedMedia: Media[];
    /** Add files to the upload queue. */
    addFiles: ( files: FileList | File[] ) => void;
    /** Start uploading all pending files in the queue. */
    startUpload: () => Promise<void>;
    /** Remove a file from the queue by its queue ID. */
    removeFromQueue: ( queueId: string ) => void;
    /** Clear the entire queue. */
    clearQueue: () => void;
    /** Clear uploaded media results. */
    clearUploaded: () => void;
    /** Drag event handlers for a drop zone element. */
    dropZoneProps: {
        onDragEnter: ( e: React.DragEvent ) => void;
        onDragOver: ( e: React.DragEvent ) => void;
        onDragLeave: ( e: React.DragEvent ) => void;
        onDrop: ( e: React.DragEvent ) => void;
    };
}

let queueIdCounter = 0;

/**
 * Hook for managing media file uploads.
 *
 * Provides drag-and-drop support, upload progress tracking,
 * file validation against server config, and queue management.
 */
export function useMediaUpload( options: UseMediaUploadOptions = {} ): UseMediaUploadReturn {
    const {
        folderId,
        tagIds,
        onUploadComplete,
        onQueueComplete,
        autoFetchConfig = true,
    } = options;

    const [ queue, setQueue ]                       = useState<UploadQueueItem[]>( [] );
    const queueRef                                  = useRef<UploadQueueItem[]>( [] );
    const [ isUploading, setIsUploading ]           = useState( false );
    const [ isDragging, setIsDragging ]             = useState( false );
    const [ config, setConfig ]                     = useState<MediaConfigResponse | null>( null );
    const [ validationErrors, setValidationErrors ] = useState<string[]>( [] );
    const [ uploadedMedia, setUploadedMedia ]       = useState<Media[]>( [] );

    // Keep queueRef in sync for stable reads inside startUpload
    useEffect( () => {
        queueRef.current = queue;
    }, [ queue ] );

    const dragCounter  = useRef( 0 );
    const optionsRef   = useRef( options );
    optionsRef.current = options;

    // Fetch upload config on mount
    useEffect( () => {
        if ( autoFetchConfig ) {
            fetchMediaConfig()
                .then( setConfig )
                .catch( () => { /* non-critical */ } );
        }
    }, [ autoFetchConfig ] );

    /**
     * Validate a file against the server config.
     */
    const validateFile = useCallback( ( file: File ): string | null => {
        if ( ! config ) {
            return null;
        }

        // Check file size (config is in KB)
        const maxSizeBytes = config.upload.max_file_size * 1024;
        if ( file.size > maxSizeBytes ) {
            return `${ file.name } exceeds the maximum file size of ${ config.upload.max_file_size_human }`;
        }

        // Check MIME type (values are arrays of MIME strings grouped by category)
        const allowedMimes = Object.values( config.upload.allowed_mime_types ).flat();
        const allowedExts  = ( config.upload.allowed_extensions || [] )
            .map( ( ext: string ) => ext.toLowerCase() );
        const fileExt      = ( file.name.split( '.' ).pop() || '' ).toLowerCase();
        const mimeOk       = allowedMimes.length === 0 || allowedMimes.includes( file.type );
        const extOk        = allowedExts.length === 0 || allowedExts.includes( fileExt );

        // Reject if MIME fails and extension also fails (or isn't configured)
        if ( ! mimeOk && ! extOk ) {
            return `${ file.name } has an unsupported file type (${ file.type })`;
        }

        // If no MIME types configured, enforce extensions alone
        if ( allowedMimes.length === 0 && ! extOk ) {
            return `${ file.name } has an unsupported file type (${ file.type })`;
        }

        return null;
    }, [ config ] );

    /**
     * Add files to the upload queue after validation.
     */
    const addFiles = useCallback( ( files: FileList | File[] ) => {
        const fileArray = Array.from( files );
        const errors: string[]         = [];
        const validItems: UploadQueueItem[] = [];

        for ( const file of fileArray ) {
            const validationError = validateFile( file );
            if ( validationError ) {
                errors.push( validationError );
            } else {
                queueIdCounter += 1;
                validItems.push( {
                    id:       `upload-${ queueIdCounter }`,
                    file,
                    progress: 0,
                    status:   'pending',
                    error:    null,
                    media:    null,
                } );
            }
        }

        setValidationErrors( errors );
        if ( validItems.length > 0 ) {
            setQueue( ( prev ) => [ ...prev, ...validItems ] );
        }
    }, [ validateFile ] );

    /**
     * Start uploading all pending files in the queue.
     * Reads from queueRef so it always sees the latest state.
     */
    const startUpload = useCallback( async () => {
        const pendingItems = queueRef.current.filter( ( item ) => item.status === 'pending' );
        if ( pendingItems.length === 0 ) {
            return;
        }

        setIsUploading( true );
        const results: Media[] = [];

        for ( const item of pendingItems ) {
            // Mark as uploading
            setQueue( ( prev ) =>
                prev.map( ( q ) =>
                    q.id === item.id ? { ...q, status: 'uploading' as const } : q,
                ),
            );

            try {
                const metadata: Record<string, string | number | number[]> = {};
                if ( optionsRef.current.folderId ) {
                    metadata.folder_id = optionsRef.current.folderId;
                }
                if ( optionsRef.current.tagIds && optionsRef.current.tagIds.length > 0 ) {
                    metadata.tags = optionsRef.current.tagIds;
                }

                const response = await uploadMedia(
                    item.file,
                    metadata,
                    ( percent ) => {
                        setQueue( ( prev ) =>
                            prev.map( ( q ) =>
                                q.id === item.id ? { ...q, progress: percent } : q,
                            ),
                        );
                    },
                );

                // Mark as complete
                setQueue( ( prev ) =>
                    prev.map( ( q ) =>
                        q.id === item.id
                            ? { ...q, status: 'complete' as const, progress: 100, media: response.data }
                            : q,
                    ),
                );

                setUploadedMedia( ( prev ) => [ ...prev, response.data ] );
                results.push( response.data );
                optionsRef.current.onUploadComplete?.( response.data );
            } catch ( err ) {
                setQueue( ( prev ) =>
                    prev.map( ( q ) =>
                        q.id === item.id
                            ? {
                                ...q,
                                status: 'error' as const,
                                error:  err instanceof Error ? err.message : 'Upload failed',
                            }
                            : q,
                    ),
                );
            }
        }

        setIsUploading( false );
        optionsRef.current.onQueueComplete?.( results );
    }, [] );

    const removeFromQueue = useCallback( ( queueId: string ) => {
        setQueue( ( prev ) => prev.filter( ( item ) => item.id !== queueId ) );
    }, [] );

    const clearQueue = useCallback( () => {
        setQueue( [] );
        setValidationErrors( [] );
    }, [] );

    const clearUploaded = useCallback( () => {
        setUploadedMedia( [] );
    }, [] );

    // Drag-and-drop handlers
    const onDragEnter = useCallback( ( e: React.DragEvent ) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if ( e.dataTransfer.items.length > 0 ) {
            setIsDragging( true );
        }
    }, [] );

    const onDragOver = useCallback( ( e: React.DragEvent ) => {
        e.preventDefault();
        e.stopPropagation();
    }, [] );

    const onDragLeave = useCallback( ( e: React.DragEvent ) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if ( dragCounter.current === 0 ) {
            setIsDragging( false );
        }
    }, [] );

    const onDrop = useCallback( ( e: React.DragEvent ) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging( false );
        dragCounter.current = 0;

        if ( e.dataTransfer.files.length > 0 ) {
            addFiles( e.dataTransfer.files );
        }
    }, [ addFiles ] );

    return {
        queue,
        isUploading,
        isDragging,
        config,
        validationErrors,
        uploadedMedia,
        addFiles,
        startUpload,
        removeFromQueue,
        clearQueue,
        clearUploaded,
        dropZoneProps: {
            onDragEnter,
            onDragOver,
            onDragLeave,
            onDrop,
        },
    };
}
