// @ts-nocheck — published media-library source uses an older @artisanpack-ui/react Alert/Tooltip API than Keystone's. The runtime works (extra props are no-ops); silencing tsc until the next package re-publish resyncs the types.
/**
 * ArtisanPack UI Media Library - MediaEdit Component
 *
 * Metadata editor for media items including title, alt text, caption,
 * description, folder assignment, and tag management.
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input, Textarea, Select, Card, Alert, Badge, Modal } from '@artisanpack-ui/react';
import { cn } from '@artisanpack-ui/tokens';

import type { Media, MediaFolder, MediaTag, MediaUpdatePayload } from '../types/media';

import { updateMedia, deleteMedia, fetchFolders, fetchTags } from '../utils/api';
import { Portal } from '../utils/Portal';

/**
 * Props for the MediaEdit component.
 */
export interface MediaEditProps {
    /** The media item to edit. */
    media: Media;
    /** Called when the editor should close. */
    onClose: () => void;
    /** Called after a successful save. */
    onSave?: ( media: Media ) => void;
    /** Called after a successful deletion. */
    onDelete?: () => void;
    /** Additional CSS class names. */
    className?: string;
}

/**
 * Metadata editor for media items.
 */
export const MediaEdit: React.FC<MediaEditProps> = ( {
    media,
    onClose,
    onSave,
    onDelete,
    className,
} ) => {
    const [ form, setForm ] = useState( {
        title:       media.title || '',
        alt_text:    media.alt_text || '',
        caption:     media.caption || '',
        description: media.description || '',
        folder_id:   media.folder.id,
    } );
    const [ selectedTagIds, setSelectedTagIds ] = useState<number[]>(
        media.tags?.map( ( t ) => t.id ) || [],
    );
    const [ folders, setFolders ]             = useState<MediaFolder[]>( [] );
    const [ tags, setTags ]                   = useState<MediaTag[]>( [] );
    const [ saving, setSaving ]               = useState( false );
    const [ error, setError ]                 = useState<string | null>( null );
    const [ showDeleteConfirm, setShowDelete ] = useState( false );

    // Sync form state when media prop changes
    const prevMediaId = useRef( media.id );
    useEffect( () => {
        if ( media.id !== prevMediaId.current ) {
            prevMediaId.current = media.id;
            setForm( {
                title:       media.title || '',
                alt_text:    media.alt_text || '',
                caption:     media.caption || '',
                description: media.description || '',
                folder_id:   media.folder.id,
            } );
            setSelectedTagIds( media.tags?.map( ( t ) => t.id ) || [] );
        }
    }, [ media ] );

    // Load folders and tags
    useEffect( () => {
        Promise.all( [ fetchFolders(), fetchTags() ] )
            .then( ( [ foldersRes, tagsRes ] ) => {
                setFolders( foldersRes.data );
                setTags( tagsRes.data );
            } )
            .catch( () => { /* non-critical */ } );
    }, [] );

    const updateField = useCallback( ( field: string, value: string | number | null ) => {
        setForm( ( prev ) => ( { ...prev, [field]: value } ) );
    }, [] );

    const toggleTag = useCallback( ( tagId: number ) => {
        setSelectedTagIds( ( prev ) =>
            prev.includes( tagId )
                ? prev.filter( ( id ) => id !== tagId )
                : [ ...prev, tagId ],
        );
    }, [] );

    const handleSave = useCallback( async () => {
        setSaving( true );
        setError( null );

        try {
            const payload: MediaUpdatePayload = {
                title:       form.title || undefined,
                alt_text:    form.alt_text || undefined,
                caption:     form.caption || undefined,
                description: form.description || undefined,
                folder_id:   form.folder_id,
                tags:         selectedTagIds,
            };

            const response = await updateMedia( media.id, payload );
            onSave?.( response.data );
        } catch ( err ) {
            setError( err instanceof Error ? err.message : 'Failed to save' );
        } finally {
            setSaving( false );
        }
    }, [ form, selectedTagIds, media.id, onSave ] );

    const handleDelete = useCallback( async () => {
        setSaving( true );
        setError( null );

        try {
            await deleteMedia( media.id );
            onDelete?.();
        } catch ( err ) {
            setError( err instanceof Error ? err.message : 'Failed to delete' );
        } finally {
            setSaving( false );
            setShowDelete( false );
        }
    }, [ media.id, onDelete ] );

    const folderOptions = [
        { id: '', name: 'No folder' },
        ...folders.map( ( f ) => ( { id: String( f.id ), name: f.name } ) ),
    ];

    return (
        <Portal>
        <Modal
            open={ true }
            onClose={ onClose }
            title="Edit Media"
            className={ cn( '[&_.modal-box]:max-w-[90rem] [&_.modal-box]:w-11/12', className ) }
            actions={
                <>
                    <Button
                        color="error"
                        onClick={ () => setShowDelete( true ) }
                    >
                        Delete
                    </Button>
                    <div className="flex-1" />
                    <Button onClick={ onClose }>Cancel</Button>
                    <Button
                        color="primary"
                        onClick={ handleSave }
                        loading={ saving }
                    >
                        Save
                    </Button>
                </>
            }
        >
            { error && (
                <Alert type="error" className="mb-4">{ error }</Alert>
            ) }

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                { /* Preview */ }
                <div>
                    { media.is_image ? (
                        <img
                            src={ media.url }
                            alt={ media.alt_text || media.file_name }
                            className="w-full rounded-lg"
                        />
                    ) : (
                        <div className="w-full aspect-square bg-base-200 rounded-lg flex items-center justify-center">
                            <div className="text-center">
                                <svg className="w-16 h-16 mx-auto text-base-content/30 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 1 }>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <p className="text-sm text-base-content/50">{ media.file_name }</p>
                            </div>
                        </div>
                    ) }

                    { /* File info */ }
                    <div className="mt-3 text-sm text-base-content/60 space-y-1">
                        <p><strong>File:</strong> { media.file_name }</p>
                        <p><strong>Type:</strong> { media.mime_type }</p>
                        <p><strong>Size:</strong> { media.human_size }</p>
                        { media.is_image && media.width && media.height && (
                            <p><strong>Dimensions:</strong> { media.width } &times; { media.height }</p>
                        ) }
                        <p><strong>URL:</strong> <code className="text-xs break-all">{ media.url }</code></p>
                    </div>
                </div>

                { /* Form */ }
                <div className="flex flex-col gap-4">
                    <Input
                        label="Title"
                        value={ form.title }
                        onChange={ ( e ) => updateField( 'title', e.target.value ) }
                        placeholder="Media title"
                    />

                    { media.is_image && (
                        <Input
                            label="Alt Text"
                            value={ form.alt_text }
                            onChange={ ( e ) => updateField( 'alt_text', e.target.value ) }
                            placeholder="Describe this image for accessibility"
                            hint="Important for accessibility and SEO"
                        />
                    ) }

                    <Input
                        label="Caption"
                        value={ form.caption }
                        onChange={ ( e ) => updateField( 'caption', e.target.value ) }
                        placeholder="Optional caption"
                    />

                    <Textarea
                        label="Description"
                        value={ form.description }
                        onChange={ ( e ) => updateField( 'description', e.target.value ) }
                        placeholder="Optional description"
                    />

                    <Select
                        label="Folder"
                        options={ folderOptions }
                        value={ form.folder_id ? String( form.folder_id ) : '' }
                        onChange={ ( e ) => {
                            const val = e.target.value;
                            updateField( 'folder_id', val ? Number( val ) : null );
                        } }
                        optionValue="id"
                        optionLabel="name"
                    />

                    { /* Tags */ }
                    <div>
                        <label className="label">
                            <span className="label-text">Tags</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            { tags.map( ( tag ) => (
                                <button
                                    key={ tag.id }
                                    type="button"
                                    onClick={ () => toggleTag( tag.id ) }
                                >
                                    <Badge
                                        value={ tag.name }
                                        color={ selectedTagIds.includes( tag.id ) ? 'primary' : 'neutral' }
                                    />
                                </button>
                            ) ) }
                            { tags.length === 0 && (
                                <p className="text-sm text-base-content/50">No tags available</p>
                            ) }
                        </div>
                    </div>
                </div>
            </div>

            { /* Delete confirmation */ }
            <Modal
                open={ showDeleteConfirm }
                onClose={ () => setShowDelete( false ) }
                title="Delete Media"
                actions={
                    <>
                        <Button onClick={ () => setShowDelete( false ) }>Cancel</Button>
                        <Button
                            color="error"
                            onClick={ handleDelete }
                            loading={ saving }
                        >
                            Delete permanently
                        </Button>
                    </>
                }
            >
                <p>
                    Are you sure you want to delete <strong>{ media.title || media.file_name }</strong>?
                    This will remove the file and all generated thumbnails. This action cannot be undone.
                </p>
            </Modal>
        </Modal>
        </Portal>
    );
};
