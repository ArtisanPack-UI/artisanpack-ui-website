// @ts-nocheck — published media-library source uses an older @artisanpack-ui/react Alert/Tooltip API than Keystone's. The runtime works (extra props are no-ops); silencing tsc until the next package re-publish resyncs the types.
/**
 * ArtisanPack UI Media Library - TagManager Component
 *
 * Tag management with create, rename, delete, and attach/detach support.
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input, Textarea, Card, Alert, Badge, Modal } from '@artisanpack-ui/react';
import { cn } from '@artisanpack-ui/tokens';

import type { MediaTag } from '../types/media';

import { fetchTags, createTag, updateTag, deleteTag } from '../utils/api';
import { Portal } from '../utils/Portal';

/**
 * Props for the TagManager component.
 */
export interface TagManagerProps {
    /** Called when tags change. */
    onTagsChange?: ( tags: MediaTag[] ) => void;
    /** Called when a tag is selected for filtering. */
    onTagSelect?: ( tagSlug: string | null ) => void;
    /** Currently selected tag slug. */
    selectedTag?: string | null;
    /** Additional CSS class names. */
    className?: string;
}

/**
 * Generate a slug from a name.
 */
function slugify( name: string ): string {
    return name
        .toLowerCase()
        .replace( /[^a-z0-9]+/g, '-' )
        .replace( /^-+|-+$/g, '' );
}

/**
 * Tag management component.
 */
export const TagManager: React.FC<TagManagerProps> = ( {
    onTagsChange,
    onTagSelect,
    selectedTag = null,
    className,
} ) => {
    const [ tags, setTags ]           = useState<MediaTag[]>( [] );
    const [ loading, setLoading ]     = useState( true );
    const [ error, setError ]         = useState<string | null>( null );
    const [ showForm, setShowForm ]   = useState( false );
    const [ editing, setEditing ]     = useState<MediaTag | null>( null );
    const [ deleting, setDeleting ]   = useState<MediaTag | null>( null );
    const [ saving, setSaving ]       = useState( false );

    const [ form, setForm ] = useState( {
        name:        '',
        slug:        '',
        description: '',
    } );

    const onTagsChangeRef   = useRef( onTagsChange );
    onTagsChangeRef.current = onTagsChange;

    const loadTags = useCallback( async () => {
        setLoading( true );
        try {
            const response = await fetchTags();
            setTags( response.data );
            onTagsChangeRef.current?.( response.data );
        } catch ( err ) {
            setError( err instanceof Error ? err.message : 'Failed to load tags' );
        } finally {
            setLoading( false );
        }
    }, [] );

    useEffect( () => {
        loadTags();
    }, [ loadTags ] );

    const resetForm = useCallback( () => {
        setForm( { name: '', slug: '', description: '' } );
        setEditing( null );
        setShowForm( false );
    }, [] );

    const handleEdit = useCallback( ( tag: MediaTag ) => {
        setForm( {
            name:        tag.name,
            slug:        tag.slug,
            description: tag.description || '',
        } );
        setEditing( tag );
        setShowForm( true );
    }, [] );

    const handleSave = useCallback( async () => {
        setSaving( true );
        setError( null );

        try {
            const data = {
                name:        form.name,
                slug:        form.slug || slugify( form.name ),
                description: form.description || undefined,
            };

            if ( editing ) {
                await updateTag( editing.id, data );
            } else {
                await createTag( data );
            }

            resetForm();
            await loadTags();
        } catch ( err ) {
            setError( err instanceof Error ? err.message : 'Failed to save tag' );
        } finally {
            setSaving( false );
        }
    }, [ form, editing, resetForm, loadTags ] );

    const handleDelete = useCallback( async () => {
        if ( ! deleting ) {
            return;
        }

        setSaving( true );
        setError( null );

        try {
            const deletedSlug = deleting.slug;
            await deleteTag( deleting.id );
            setDeleting( null );
            if ( selectedTag === deletedSlug ) {
                onTagSelect?.( null );
            }
            await loadTags();
        } catch ( err ) {
            setError( err instanceof Error ? err.message : 'Failed to delete tag' );
        } finally {
            setSaving( false );
        }
    }, [ deleting, selectedTag, onTagSelect, loadTags ] );

    return (
        <Card className={ className }>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">Tags</h3>
                <Button
                    size="sm"
                    color="primary"
                    onClick={ () => {
                        resetForm();
                        setShowForm( true );
                    } }
                >
                    <svg className="w-4 h-4 mr-1" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    New
                </Button>
            </div>

            { error && <Alert type="error" className="mb-3">{ error }</Alert> }

            { /* Tag list */ }
            <div className="flex flex-wrap gap-2">
                { /* All tags option */ }
                <button
                    type="button"
                    className="rounded-full transition-opacity hover:opacity-75"
                    onClick={ () => onTagSelect?.( null ) }
                >
                    <Badge
                        value="All"
                        color={ selectedTag === null ? 'primary' : 'neutral' }
                    />
                </button>

                { tags.map( ( tag ) => (
                    <div key={ tag.id } className="group relative inline-flex" tabIndex={ 0 }>
                        <button
                            type="button"
                            className="rounded-full transition-opacity hover:opacity-75"
                            onClick={ () => onTagSelect?.( tag.slug ) }
                        >
                            <Badge
                                value={ `${ tag.name }${ tag.media_count !== undefined ? ` (${ tag.media_count })` : '' }` }
                                color={ selectedTag === tag.slug ? 'primary' : 'neutral' }
                            />
                        </button>

                        <div className="absolute -top-1 -right-1 invisible flex gap-0.5 group-hover:visible group-focus-within:visible">
                            <button
                                type="button"
                                className="w-4 h-4 rounded-full bg-base-300 flex items-center justify-center transition-colors hover:bg-base-content/20"
                                onClick={ () => handleEdit( tag ) }
                                aria-label={ `Edit ${ tag.name }` }
                            >
                                <svg className="w-2.5 h-2.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                className="w-4 h-4 rounded-full bg-error text-error-content flex items-center justify-center transition-colors hover:bg-error/80"
                                onClick={ () => setDeleting( tag ) }
                                aria-label={ `Delete ${ tag.name }` }
                            >
                                <svg className="w-2.5 h-2.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                ) ) }
            </div>

            { /* Create/Edit form */ }
            { showForm && (
            <Portal>
            <Modal
                open
                onClose={ resetForm }
                title={ editing ? 'Edit Tag' : 'New Tag' }
                actions={
                    <>
                        <Button onClick={ resetForm }>Cancel</Button>
                        <Button
                            color="primary"
                            onClick={ handleSave }
                            loading={ saving }
                        >
                            { editing ? 'Update' : 'Create' }
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Input
                        label="Name"
                        value={ form.name }
                        onChange={ ( e ) => {
                            const name = e.target.value;
                            setForm( ( prev ) => ( {
                                ...prev,
                                name,
                                slug: editing ? prev.slug : slugify( name ),
                            } ) );
                        } }
                        placeholder="Tag name"
                    />
                    <Input
                        label="Slug"
                        value={ form.slug }
                        onChange={ ( e ) => setForm( ( prev ) => ( { ...prev, slug: e.target.value } ) ) }
                        placeholder="tag-slug"
                        hint="URL-friendly identifier"
                    />
                    <Textarea
                        label="Description"
                        value={ form.description }
                        onChange={ ( e ) => setForm( ( prev ) => ( { ...prev, description: e.target.value } ) ) }
                        placeholder="Optional description"
                    />
                </div>
            </Modal>
            </Portal>
            ) }

            { /* Delete confirmation */ }
            { deleting && (
            <Portal>
            <Modal
                open
                onClose={ () => setDeleting( null ) }
                title="Delete Tag"
                actions={
                    <>
                        <Button onClick={ () => setDeleting( null ) }>Cancel</Button>
                        <Button
                            color="error"
                            onClick={ handleDelete }
                            loading={ saving }
                        >
                            Delete
                        </Button>
                    </>
                }
            >
                <p>
                    Are you sure you want to delete the tag <strong>{ deleting.name }</strong>?
                    It will be detached from all media items.
                </p>
            </Modal>
            </Portal>
            ) }
        </Card>
    );
};
