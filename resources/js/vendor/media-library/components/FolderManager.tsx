// @ts-nocheck — published media-library source uses an older @artisanpack-ui/react Alert/Tooltip API than Keystone's. The runtime works (extra props are no-ops); silencing tsc until the next package re-publish resyncs the types.
/**
 * ArtisanPack UI Media Library - FolderManager Component
 *
 * Folder tree management with create, rename, delete, and
 * hierarchical organization.
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input, Textarea, Select, Card, Alert, Modal } from '@artisanpack-ui/react';
import { cn } from '@artisanpack-ui/tokens';

import type { MediaFolder } from '../types/media';

import {
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
} from '../utils/api';
import { Portal } from '../utils/Portal';

/**
 * Props for the FolderManager component.
 */
export interface FolderManagerProps {
    /** Called when folders change (for parent component refresh). */
    onFoldersChange?: ( folders: MediaFolder[] ) => void;
    /** Called when a folder is selected. */
    onFolderSelect?: ( folderId: number | null ) => void;
    /** Currently selected folder ID. */
    selectedFolderId?: number | null;
    /** Additional CSS class names. */
    className?: string;
}

/**
 * Flatten a folder tree (including nested children) into a single array.
 */
function flattenFolders( folders: MediaFolder[] ): MediaFolder[] {
    const result: MediaFolder[] = [];

    for ( const folder of folders ) {
        result.push( folder );
        if ( folder.children && folder.children.length > 0 ) {
            result.push( ...flattenFolders( folder.children ) );
        }
    }

    return result;
}

/**
 * Collect all descendant IDs of a folder to prevent circular parent moves.
 */
function getDescendantIds( folderId: number, folders: MediaFolder[] ): Set<number> {
    const ids    = new Set<number>();
    const queue  = [ folderId ];

    while ( queue.length > 0 ) {
        const parentId = queue.shift()!;
        for ( const folder of folders ) {
            if ( folder.parent_id === parentId && ! ids.has( folder.id ) ) {
                ids.add( folder.id );
                queue.push( folder.id );
            }
        }
    }

    return ids;
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
 * Folder tree item component.
 */
const FolderTreeItem: React.FC<{
    folder: MediaFolder;
    depth: number;
    selectedId: number | null;
    onSelect: ( id: number | null ) => void;
    onEdit: ( folder: MediaFolder ) => void;
    onDelete: ( folder: MediaFolder ) => void;
}> = ( { folder, depth, selectedId, onSelect, onEdit, onDelete } ) => (
    <div>
        <div
            role="treeitem"
            aria-selected={ selectedId === folder.id }
            className={ cn(
                'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                'hover:bg-base-200',
                selectedId === folder.id && 'bg-primary/10 text-primary',
            ) }
            style={ { paddingLeft: `${ depth * 1.25 + 0.75 }rem` } }
            onClick={ () => onSelect( folder.id ) }
            onKeyDown={ ( e ) => {
                if ( e.key === 'Enter' ) {
                    onSelect( folder.id );
                }
            } }
            tabIndex={ 0 }
        >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
            <span className="flex-1 text-sm truncate">{ folder.name }</span>
            { folder.media_count !== undefined && (
                <span className="text-xs text-base-content/40">{ folder.media_count }</span>
            ) }

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:opacity-100">
                <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={ ( e ) => { e.stopPropagation(); onEdit( folder ); } }
                    aria-label={ `Edit ${ folder.name }` }
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                </button>
                <button
                    type="button"
                    className="btn btn-ghost btn-xs text-error"
                    onClick={ ( e ) => { e.stopPropagation(); onDelete( folder ); } }
                    aria-label={ `Delete ${ folder.name }` }
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                </button>
            </div>
        </div>

        { folder.children && folder.children.length > 0 && (
            <div role="group">
                { folder.children.map( ( child ) => (
                    <FolderTreeItem
                        key={ child.id }
                        folder={ child }
                        depth={ depth + 1 }
                        selectedId={ selectedId }
                        onSelect={ onSelect }
                        onEdit={ onEdit }
                        onDelete={ onDelete }
                    />
                ) ) }
            </div>
        ) }
    </div>
);

/**
 * Folder tree management component.
 */
export const FolderManager: React.FC<FolderManagerProps> = ( {
    onFoldersChange,
    onFolderSelect,
    selectedFolderId = null,
    className,
} ) => {
    const [ folders, setFolders ]       = useState<MediaFolder[]>( [] );
    const [ loading, setLoading ]       = useState( true );
    const [ error, setError ]           = useState<string | null>( null );
    const [ showForm, setShowForm ]     = useState( false );
    const [ editing, setEditing ]       = useState<MediaFolder | null>( null );
    const [ deleting, setDeleting ]     = useState<MediaFolder | null>( null );
    const [ saving, setSaving ]         = useState( false );

    const [ form, setForm ] = useState( {
        name:        '',
        slug:        '',
        description: '',
        parent_id:   null as number | null,
    } );

    const onFoldersChangeRef   = useRef( onFoldersChange );
    onFoldersChangeRef.current = onFoldersChange;

    const loadFolders = useCallback( async () => {
        setLoading( true );
        try {
            const response = await fetchFolders();
            setFolders( response.data );
            onFoldersChangeRef.current?.( response.data );
        } catch ( err ) {
            setError( err instanceof Error ? err.message : 'Failed to load folders' );
        } finally {
            setLoading( false );
        }
    }, [] );

    useEffect( () => {
        loadFolders();
    }, [ loadFolders ] );

    const resetForm = useCallback( () => {
        setForm( { name: '', slug: '', description: '', parent_id: null } );
        setEditing( null );
        setShowForm( false );
    }, [] );

    const handleEdit = useCallback( ( folder: MediaFolder ) => {
        setForm( {
            name:        folder.name,
            slug:        folder.slug,
            description: folder.description || '',
            parent_id:   folder.parent_id,
        } );
        setEditing( folder );
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
                parent_id:   form.parent_id,
            };

            if ( editing ) {
                await updateFolder( editing.id, data );
            } else {
                await createFolder( data );
            }

            resetForm();
            await loadFolders();
        } catch ( err ) {
            setError( err instanceof Error ? err.message : 'Failed to save folder' );
        } finally {
            setSaving( false );
        }
    }, [ form, editing, resetForm, loadFolders ] );

    const handleDelete = useCallback( async () => {
        if ( ! deleting ) {
            return;
        }

        setSaving( true );
        setError( null );

        try {
            await deleteFolder( deleting.id );
            setDeleting( null );
            await loadFolders();
        } catch ( err ) {
            setError( err instanceof Error ? err.message : 'Failed to delete folder' );
        } finally {
            setSaving( false );
        }
    }, [ deleting, loadFolders ] );

    const handleSelect = useCallback( ( id: number | null ) => {
        onFolderSelect?.( selectedFolderId === id ? null : id );
    }, [ selectedFolderId, onFolderSelect ] );

    // Flatten nested folder tree and exclude editing folder + all its descendants
    const allFolders  = flattenFolders( folders );
    const excludedIds = editing ? getDescendantIds( editing.id, allFolders ) : new Set<number>();
    const parentOptions = [
        { id: '', name: 'No parent (root)' },
        ...allFolders
            .filter( ( f ) => ! editing || ( f.id !== editing.id && ! excludedIds.has( f.id ) ) )
            .map( ( f ) => ( { id: String( f.id ), name: f.name } ) ),
    ];

    return (
        <Card className={ className }>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">Folders</h3>
                <Button
                    size="sm"
                    color="primary"
                    onClick={ () => {
                        resetForm();
                        setShowForm( true );
                    } }
                >
                    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    New
                </Button>
            </div>

            { error && <Alert type="error" className="mb-3">{ error }</Alert> }

            { /* All media option */ }
            <div
                role="treeitem"
                aria-selected={ selectedFolderId === null }
                className={ cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                    'hover:bg-base-200',
                    selectedFolderId === null && 'bg-primary/10 text-primary',
                ) }
                onClick={ () => handleSelect( null ) }
                onKeyDown={ ( e ) => { if ( e.key === 'Enter' ) { handleSelect( null ); } } }
                tabIndex={ 0 }
            >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
                <span className="flex-1 text-sm">All Media</span>
            </div>

            { /* Folder tree */ }
            <div className="mt-1" role="tree" aria-label="Folder tree">
                { folders
                    .filter( ( f ) => ! f.parent_id )
                    .map( ( folder ) => (
                        <FolderTreeItem
                            key={ folder.id }
                            folder={ folder }
                            depth={ 0 }
                            selectedId={ selectedFolderId ?? null }
                            onSelect={ handleSelect }
                            onEdit={ handleEdit }
                            onDelete={ setDeleting }
                        />
                    ) ) }
            </div>

            { /* Create/Edit form */ }
            { showForm && (
            <Portal>
            <Modal
                open
                onClose={ resetForm }
                title={ editing ? 'Edit Folder' : 'New Folder' }
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
                        placeholder="Folder name"
                    />
                    <Input
                        label="Slug"
                        value={ form.slug }
                        onChange={ ( e ) => setForm( ( prev ) => ( { ...prev, slug: e.target.value } ) ) }
                        placeholder="folder-slug"
                        hint="URL-friendly identifier"
                    />
                    <Textarea
                        label="Description"
                        value={ form.description }
                        onChange={ ( e ) => setForm( ( prev ) => ( { ...prev, description: e.target.value } ) ) }
                        placeholder="Optional description"
                    />
                    <Select
                        label="Parent Folder"
                        options={ parentOptions }
                        value={ form.parent_id ? String( form.parent_id ) : '' }
                        onChange={ ( e ) => {
                            const val = e.target.value;
                            setForm( ( prev ) => ( { ...prev, parent_id: val ? Number( val ) : null } ) );
                        } }
                        optionValue="id"
                        optionLabel="name"
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
                title="Delete Folder"
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
                    Are you sure you want to delete the folder <strong>{ deleting.name }</strong>?
                    Media items in this folder will be moved to the root level.
                </p>
            </Modal>
            </Portal>
            ) }
        </Card>
    );
};
