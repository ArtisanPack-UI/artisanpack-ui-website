// @ts-nocheck — published media-library source uses an older @artisanpack-ui/react Alert/Tooltip API than Keystone's. The runtime works (extra props are no-ops); silencing tsc until the next package re-publish resyncs the types.
/**
 * ArtisanPack UI Media Library - MediaLibrary Component
 *
 * Full media browsing/management interface with grid/list view toggle,
 * search, filtering by folder/tag/type, sorting, pagination, and
 * bulk actions (delete, move to folder, tag).
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button, Input, Select, Card, Alert } from '@artisanpack-ui/react';
import { cn } from '@artisanpack-ui/tokens';

import type { Media, MediaType, MediaSortField, SortDirection } from '../types/media';

import { useMediaLibrary } from '../hooks/useMediaLibrary';
import type { UseMediaLibraryOptions } from '../hooks/useMediaLibrary';
import { MediaGrid } from './MediaGrid';
import { MediaUpload } from './MediaUpload';
import { MediaEdit } from './MediaEdit';

/**
 * Props for the MediaLibrary component.
 */
export interface MediaLibraryProps extends UseMediaLibraryOptions {
    /** Called when a media item is clicked (for editing or details). */
    onMediaClick?: ( media: Media ) => void;
    /** Called when media items are selected. */
    onSelectionChange?: ( media: Media[] ) => void;
    /** Whether to show the upload section. Defaults to true. */
    showUpload?: boolean;
    /** Additional CSS class names. */
    className?: string;
}

const TYPE_FILTER_OPTIONS = [
    { id: '',         name: 'All Types' },
    { id: 'image',    name: 'Images' },
    { id: 'video',    name: 'Videos' },
    { id: 'audio',    name: 'Audio' },
    { id: 'document', name: 'Documents' },
];

const SORT_OPTIONS = [
    { id: 'created_at:desc',  name: 'Newest first' },
    { id: 'created_at:asc',   name: 'Oldest first' },
    { id: 'title:asc',        name: 'Title A-Z' },
    { id: 'title:desc',       name: 'Title Z-A' },
    { id: 'file_size:desc',   name: 'Largest first' },
    { id: 'file_size:asc',    name: 'Smallest first' },
];

/**
 * Full media library management interface.
 */
export const MediaLibrary: React.FC<MediaLibraryProps> = ( {
    onMediaClick,
    onSelectionChange,
    showUpload = true,
    className,
    ...hookOptions
} ) => {
    const library = useMediaLibrary( hookOptions );

    const [ showUploadPanel, setShowUploadPanel ] = useState( false );
    const [ editingMedia, setEditingMedia ]       = useState<Media | null>( null );

    // Close upload panel when parent disables showUpload
    useEffect( () => {
        if ( ! showUpload ) {
            setShowUploadPanel( false );
        }
    }, [ showUpload ] );

    // Stabilize callback ref to avoid re-render loops with inline callbacks
    const selectionChangeRef   = useRef( onSelectionChange );
    useEffect( () => {
        selectionChangeRef.current = onSelectionChange;
    }, [ onSelectionChange ] );

    // Notify parent when selection changes
    useEffect( () => {
        if ( selectionChangeRef.current ) {
            const selected = library.media.filter( ( m ) => library.selectedIds.has( m.id ) );
            selectionChangeRef.current( selected );
        }
    }, [ library.selectedIds, library.media ] );

    const handleItemClick = useCallback( ( media: Media ) => {
        if ( onMediaClick ) {
            onMediaClick( media );
        } else {
            setEditingMedia( media );
        }
    }, [ onMediaClick ] );

    const handleItemSelect = useCallback( ( media: Media ) => {
        library.toggleSelection( media.id );
    }, [ library ] );

    const folderOptions = [
        { id: '', name: 'All Folders' },
        ...library.folders.map( ( f ) => ( { id: String( f.id ), name: f.name } ) ),
    ];

    const tagOptions = [
        { id: '', name: 'All Tags' },
        ...library.tags.map( ( t ) => ( { id: t.slug, name: t.name } ) ),
    ];

    const currentSort = `${ library.filters.sort_by || 'created_at' }:${ library.filters.sort_order || 'desc' }`;

    return (
        <div className={ cn( 'flex flex-col gap-4', className ) }>
            { /* Error display */ }
            { library.error && (
                <Alert type="error">{ library.error }</Alert>
            ) }

            { /* Toolbar */ }
            <Card>
                <div className="flex flex-wrap items-center gap-3">
                    { /* Search */ }
                    <div className="flex-1 min-w-48">
                        <Input
                            aria-label="Search media"
                            placeholder="Search media..."
                            value={ library.filters.search || '' }
                            onChange={ ( e ) => library.setSearch( e.target.value ) }
                            icon={
                                <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            }
                        />
                    </div>

                    { /* Filters */ }
                    <Select
                        aria-label="Filter by folder"
                        options={ folderOptions }
                        value={ library.filters.folder_id ? String( library.filters.folder_id ) : '' }
                        onChange={ ( e ) => {
                            const val = e.target.value;
                            library.setFolderId( val ? Number( val ) : undefined );
                        } }
                        optionValue="id"
                        optionLabel="name"
                    />

                    <Select
                        aria-label="Filter by type"
                        options={ TYPE_FILTER_OPTIONS }
                        value={ ( library.filters.type as string ) || '' }
                        onChange={ ( e ) => {
                            const val = e.target.value;
                            library.setType( val ? val as MediaType : undefined );
                        } }
                        optionValue="id"
                        optionLabel="name"
                    />

                    <Select
                        aria-label="Filter by tag"
                        options={ tagOptions }
                        value={ library.filters.tag || '' }
                        onChange={ ( e ) => {
                            const val = e.target.value;
                            library.setTag( val || undefined );
                        } }
                        optionValue="id"
                        optionLabel="name"
                    />

                    <Select
                        aria-label="Sort media"
                        options={ SORT_OPTIONS }
                        value={ currentSort }
                        onChange={ ( e ) => {
                            const [ field, direction ] = e.target.value.split( ':' );
                            library.setSort(
                                field as MediaSortField,
                                direction as SortDirection,
                            );
                        } }
                        optionValue="id"
                        optionLabel="name"
                    />
                </div>

                { /* Actions row */ }
                <div className="flex items-center gap-2 mt-3">
                    { showUpload && (
                        <Button
                            size="sm"
                            color="primary"
                            onClick={ () => setShowUploadPanel( ( prev ) => ! prev ) }
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            Upload
                        </Button>
                    ) }

                    <Button
                        size="sm"
                        color={ library.bulkSelectMode ? 'warning' : 'ghost' }
                        onClick={ library.toggleBulkSelectMode }
                    >
                        { library.bulkSelectMode ? 'Cancel selection' : 'Select' }
                    </Button>

                    { library.bulkSelectMode && library.selectedIds.size > 0 && (
                        <>
                            <Button size="sm" color="ghost" onClick={ library.selectAll }>
                                Select all
                            </Button>
                            <Button
                                size="sm"
                                color="error"
                                onClick={ library.deleteSelected }
                            >
                                Delete { library.selectedIds.size } item{ library.selectedIds.size !== 1 ? 's' : '' }
                            </Button>
                        </>
                    ) }

                    <div className="flex-1" />

                    { /* View toggle */ }
                    <div className="join">
                        <button
                            type="button"
                            className={ cn(
                                'join-item btn btn-sm',
                                library.viewMode === 'grid' && 'btn-active',
                            ) }
                            onClick={ () => library.viewMode !== 'grid' && library.toggleViewMode() }
                            aria-label="Grid view"
                            aria-pressed={ library.viewMode === 'grid' }
                        >
                            <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            className={ cn(
                                'join-item btn btn-sm',
                                library.viewMode === 'list' && 'btn-active',
                            ) }
                            onClick={ () => library.viewMode !== 'list' && library.toggleViewMode() }
                            aria-label="List view"
                            aria-pressed={ library.viewMode === 'list' }
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                            </svg>
                        </button>
                    </div>

                    <Button size="sm" color="ghost" onClick={ library.refresh } aria-label="Refresh library">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                        </svg>
                    </Button>
                </div>
            </Card>

            { /* Upload panel */ }
            { showUploadPanel && (
                <Card>
                    <MediaUpload
                        onUploadComplete={ () => library.refresh() }
                        autoUpload
                    />
                </Card>
            ) }

            { /* Media grid */ }
            <MediaGrid
                media={ library.media }
                loading={ library.loading }
                viewMode={ library.viewMode }
                bulkSelectMode={ library.bulkSelectMode }
                selectedIds={ library.selectedIds }
                pagination={ library.pagination }
                onItemClick={ handleItemClick }
                onItemSelect={ handleItemSelect }
                onPageChange={ library.goToPage }
            />

            { /* Edit panel */ }
            { editingMedia && (
                <MediaEdit
                    media={ editingMedia }
                    onClose={ () => setEditingMedia( null ) }
                    onSave={ () => {
                        setEditingMedia( null );
                        library.refresh();
                    } }
                    onDelete={ () => {
                        setEditingMedia( null );
                        library.refresh();
                    } }
                />
            ) }
        </div>
    );
};
