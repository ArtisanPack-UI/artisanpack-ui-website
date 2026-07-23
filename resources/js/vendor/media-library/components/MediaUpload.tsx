// @ts-nocheck — published media-library source uses an older @artisanpack-ui/react Alert/Tooltip API than Keystone's. The runtime works (extra props are no-ops); silencing tsc until the next package re-publish resyncs the types.
/**
 * ArtisanPack UI Media Library - MediaUpload Component
 *
 * Drag-and-drop file uploader with multi-file support, upload progress
 * indicators, and file type/size validation.
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import React, { useRef } from 'react';
import { Button, Alert, Progress, Card } from '@artisanpack-ui/react';
import { cn } from '@artisanpack-ui/tokens';

import type { Media } from '../types/media';

import { useMediaUpload } from '../hooks/useMediaUpload';
import type { UseMediaUploadOptions, UploadQueueItem } from '../hooks/useMediaUpload';

/**
 * Props for the MediaUpload component.
 */
export interface MediaUploadProps extends UseMediaUploadOptions {
    /** Label text for the drop zone. */
    label?: string;
    /** Accepted file types for the file input. */
    accept?: string;
    /** Whether to auto-start uploading when files are added. */
    autoUpload?: boolean;
    /** Additional CSS class names. */
    className?: string;
}

/**
 * Render a single upload queue item.
 */
const QueueItem: React.FC<{
    item: UploadQueueItem;
    onRemove: ( id: string ) => void;
    disabled?: boolean;
}> = ( { item, onRemove, disabled = false } ) => (
    <div className="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
        <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{ item.file.name }</p>
            <p className="text-xs text-base-content/60">
                { ( item.file.size / 1024 ).toFixed( 1 ) } KB
            </p>

            { item.status === 'uploading' && (
                <Progress
                    value={ item.progress }
                    color="primary"
                    className="mt-1"
                />
            ) }

            { item.status === 'error' && (
                <p className="text-xs text-error mt-1">{ item.error }</p>
            ) }

            { item.status === 'complete' && (
                <p className="text-xs text-success mt-1">Uploaded successfully</p>
            ) }
        </div>

        { item.status !== 'uploading' && (
            <Button
                size="sm"
                color="ghost"
                onClick={ () => onRemove( item.id ) }
                disabled={ disabled }
                aria-label={ `Remove ${ item.file.name }` }
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </Button>
        ) }
    </div>
);

/**
 * Drag-and-drop file uploader with progress tracking.
 */
export const MediaUpload: React.FC<MediaUploadProps> = ( {
    label = 'Drop files here or click to browse',
    accept,
    autoUpload = false,
    className,
    ...hookOptions
} ) => {
    const fileInputRef = useRef<HTMLInputElement>( null );

    const {
        queue,
        isUploading,
        isDragging,
        validationErrors,
        addFiles,
        startUpload,
        removeFromQueue,
        clearQueue,
        dropZoneProps,
    } = useMediaUpload( hookOptions );

    const handleFileSelect = ( e: React.ChangeEvent<HTMLInputElement> ) => {
        if ( e.target.files && e.target.files.length > 0 ) {
            addFiles( e.target.files );

            if ( autoUpload ) {
                // Small delay to let state update
                setTimeout( () => startUpload(), 0 );
            }
        }

        // Reset the input so the same file can be selected again
        e.target.value = '';
    };

    const handleBrowseClick = () => {
        fileInputRef.current?.click();
    };

    const pendingCount  = queue.filter( ( q ) => q.status === 'pending' ).length;
    const completeCount = queue.filter( ( q ) => q.status === 'complete' ).length;

    return (
        <div className={ className }>
            { /* Drop zone */ }
            <div
                { ...dropZoneProps }
                onClick={ handleBrowseClick }
                role="button"
                tabIndex={ 0 }
                onKeyDown={ ( e ) => {
                    if ( e.key === 'Enter' || e.key === ' ' ) {
                        e.preventDefault();
                        handleBrowseClick();
                    }
                } }
                aria-label={ label }
                className={ cn(
                    'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                    'hover:border-primary hover:bg-primary/5',
                    isDragging && 'border-primary bg-primary/10',
                    ! isDragging && 'border-base-300',
                ) }
            >
                <svg className="w-10 h-10 mx-auto text-base-content/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 1.5 }>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-base-content/60">{ label }</p>
                <p className="text-xs text-base-content/40 mt-1">
                    Supports images, videos, audio, and documents
                </p>

                <input
                    ref={ fileInputRef }
                    type="file"
                    multiple
                    accept={ accept }
                    onChange={ handleFileSelect }
                    className="hidden"
                    aria-hidden="true"
                />
            </div>

            { /* Validation errors */ }
            { validationErrors.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                    { validationErrors.map( ( error, index ) => (
                        <Alert key={ index } type="error">
                            { error }
                        </Alert>
                    ) ) }
                </div>
            ) }

            { /* Upload queue */ }
            { queue.length > 0 && (
                <Card className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium">
                            { isUploading
                                ? 'Uploading...'
                                : `${ queue.length } file${ queue.length !== 1 ? 's' : '' } queued` }
                            { completeCount > 0 && ` (${ completeCount } complete)` }
                        </p>
                        <div className="flex gap-2">
                            { pendingCount > 0 && ! isUploading && (
                                <Button
                                    size="sm"
                                    color="primary"
                                    onClick={ startUpload }
                                >
                                    Upload { pendingCount } file{ pendingCount !== 1 ? 's' : '' }
                                </Button>
                            ) }
                            { ! isUploading && (
                                <Button
                                    size="sm"
                                    color="ghost"
                                    onClick={ clearQueue }
                                >
                                    Clear
                                </Button>
                            ) }
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                        { queue.map( ( item ) => (
                            <QueueItem
                                key={ item.id }
                                item={ item }
                                onRemove={ removeFromQueue }
                                disabled={ isUploading }
                            />
                        ) ) }
                    </div>
                </Card>
            ) }
        </div>
    );
};
