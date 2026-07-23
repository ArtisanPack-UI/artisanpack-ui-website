/**
 * ArtisanPack UI Media Library - MediaModal Component
 *
 * Modal-based media picker with library browsing tab, upload tab,
 * multi-select support, recently used tracking, and keyboard navigation.
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Input, Select, Tabs, Badge } from '@artisanpack-ui/react';
import { cn } from '@artisanpack-ui/tokens';

import type { Media, MediaType, MediaFolder } from '../types/media';

import { fetchFolders } from '../utils/api';
import { Portal } from '../utils/Portal';
import { useMediaPicker } from '../hooks/useMediaPicker';
import type { UseMediaPickerOptions } from '../hooks/useMediaPicker';
import { MediaGrid } from './MediaGrid';
import { MediaUpload } from './MediaUpload';

/**
 * Props for the MediaModal component.
 */
export interface MediaModalProps extends Omit<UseMediaPickerOptions, 'onSelect'> {
    /** Whether the modal is open. */
    open: boolean;
    /** Called when the modal should close. */
    onClose: () => void;
    /** Called when media is selected and confirmed. */
    onSelect?: ( media: Media[], context: string ) => void;
    /** Modal title. */
    title?: string;
    /** Show the upload tab. Defaults to true. */
    showUploadTab?: boolean;
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

/**
 * Modal-based media picker with library and upload tabs.
 */
export const MediaModal: React.FC<MediaModalProps> = ( {
    open,
    onClose,
    onSelect,
    title         = 'Select Media',
    showUploadTab = true,
    className,
    multiSelect   = false,
    maxSelections,
    allowedTypes,
    context = 'default',
    perPage = 24,
} ) => {
    const [ activeTab, setActiveTab ] = useState<'library' | 'upload'>( 'library' );
    const [ folders, setFolders ]     = useState<MediaFolder[]>( [] );

    const picker = useMediaPicker( {
        multiSelect,
        maxSelections,
        allowedTypes,
        context,
        perPage,
        onSelect: ( media, ctx ) => {
            onSelect?.( media, ctx );
            onClose();
        },
    } );

    // Load folders
    useEffect( () => {
        if ( open ) {
            fetchFolders()
                .then( ( response ) => setFolders( response.data ) )
                .catch( () => { /* non-critical */ } );
        }
    }, [ open ] );

    // Keyboard navigation — skip when focus is inside a form control
    const handleKeyDown = useCallback( ( e: React.KeyboardEvent ) => {
        const target = e.target as HTMLElement;
        const tagName = target.tagName.toLowerCase();
        if ( tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable ) {
            return;
        }

        switch ( e.key ) {
            case 'ArrowRight':
                e.preventDefault();
                picker.focusNext();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                picker.focusPrevious();
                break;
            case 'Enter':
            case ' ':
                if ( picker.focusedIndex >= 0 ) {
                    e.preventDefault();
                    picker.selectFocused();
                }
                break;
        }
    }, [ picker ] );

    // Handle upload complete — switch to library and refresh
    const handleUploadComplete = useCallback( ( media: Media ) => {
        if ( ! multiSelect ) {
            // Auto-select newly uploaded item
            onSelect?.( [ media ], context );
            onClose();
        } else {
            setActiveTab( 'library' );
            picker.refresh();
        }
    }, [ multiSelect, onSelect, context, onClose, picker ] );

    const folderOptions = [
        { id: '', name: 'All Folders' },
        ...folders.map( ( f ) => ( { id: String( f.id ), name: f.name } ) ),
    ];

    const selectedCount = picker.selectedMedia.length;

    return (
        <Portal>
        <Modal
            open={ open }
            onClose={ onClose }
            title={ title }
            className={ cn( '[&_.modal-box]:max-w-5xl [&_.modal-box]:w-11/12', className ) }
            actions={
                <>
                    <Button onClick={ onClose }>Cancel</Button>
                    <Button
                        color="primary"
                        onClick={ picker.confirmSelection }
                        loading={ picker.loading }
                    >
                        { selectedCount > 0
                            ? `Select ${ selectedCount } item${ selectedCount !== 1 ? 's' : '' }`
                            : 'Select' }
                    </Button>
                </>
            }
        >
            <div onKeyDown={ handleKeyDown }>
                { /* Tabs */ }
                <Tabs
                    tabs={ [
                        { name: 'library', label: 'Library', content: null },
                        ...( showUploadTab ? [ { name: 'upload', label: 'Upload', content: null } ] : [] ),
                    ] }
                    activeTab={ activeTab }
                    onChange={ ( name ) => setActiveTab( name as 'library' | 'upload' ) }
                />

                { activeTab === 'library' && (
                    <div className="mt-4">
                        { /* Filters */ }
                        <div className="flex flex-wrap gap-3 mb-4">
                            <div className="flex-1 min-w-48">
                                <Input
                                    placeholder="Search media..."
                                    value={ picker.search }
                                    onChange={ ( e ) => picker.setSearch( e.target.value ) }
                                    icon={
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    }
                                />
                            </div>
                            <Select
                                options={ folderOptions }
                                value={ picker.folderId ? String( picker.folderId ) : '' }
                                onChange={ ( e ) => {
                                    const val = e.target.value;
                                    picker.setFolderId( val ? Number( val ) : undefined );
                                } }
                                optionValue="id"
                                optionLabel="name"
                            />
                            <Select
                                options={ TYPE_FILTER_OPTIONS }
                                value={ picker.typeFilter || '' }
                                onChange={ ( e ) => {
                                    const val = e.target.value;
                                    picker.setTypeFilter( val ? val as MediaType : undefined );
                                } }
                                optionValue="id"
                                optionLabel="name"
                            />
                        </div>

                        { /* Recently used */ }
                        { picker.recentlyUsed.length > 0 && ! picker.search && (
                            <div className="mb-4">
                                <p className="text-xs font-medium text-base-content/60 mb-2">
                                    Recently Used
                                </p>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    { picker.recentlyUsed.map( ( item ) => (
                                        <button
                                            key={ item.id }
                                            type="button"
                                            onClick={ () => picker.toggleSelect( item ) }
                                            className={ cn(
                                                'w-14 h-14 shrink-0 rounded-lg overflow-hidden ring-2 transition-all',
                                                picker.selectedMedia.some( ( m ) => m.id === item.id )
                                                    ? 'ring-primary'
                                                    : 'ring-transparent hover:ring-base-300',
                                            ) }
                                        >
                                            { item.is_image ? (
                                                <img
                                                    src={ item.url }
                                                    alt={ item.alt_text || item.file_name }
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-base-200 flex items-center justify-center">
                                                    <span className="text-xs text-base-content/50">
                                                        { item.file_name.split( '.' ).pop()?.toUpperCase() }
                                                    </span>
                                                </div>
                                            ) }
                                        </button>
                                    ) ) }
                                </div>
                            </div>
                        ) }

                        { /* Media grid */ }
                        <MediaGrid
                            media={ picker.media }
                            loading={ picker.loading }
                            viewMode="grid"
                            selectedIds={ new Set( picker.selectedMedia.map( ( m ) => m.id ) ) }
                            focusedIndex={ picker.focusedIndex }
                            pagination={ picker.pagination }
                            onItemClick={ ( media ) => picker.toggleSelect( media ) }
                            onItemSelect={ ( media ) => picker.toggleSelect( media ) }
                            onPageChange={ picker.goToPage }
                        />

                        { /* Selection info */ }
                        { selectedCount > 0 && (
                            <div className="mt-3 flex items-center gap-2">
                                <Badge value={ `${ selectedCount } selected` } color="primary" />
                                <Button size="sm" color="ghost" onClick={ picker.clearSelection }>
                                    Clear selection
                                </Button>
                            </div>
                        ) }
                    </div>
                ) }

                { activeTab === 'upload' && (
                    <div className="mt-4">
                        <MediaUpload
                            onUploadComplete={ handleUploadComplete }
                            autoUpload
                        />
                    </div>
                ) }
            </div>
        </Modal>
        </Portal>
    );
};
