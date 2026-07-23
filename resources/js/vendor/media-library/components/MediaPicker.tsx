/**
 * ArtisanPack UI Media Library - MediaPicker Component
 *
 * Lightweight inline media selector for embedding in forms.
 * Shows selected media with a button to open the media modal.
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import React, { useState, useCallback } from 'react';
import { Button, Card } from '@artisanpack-ui/react';
import { cn } from '@artisanpack-ui/tokens';

import type { Media, MediaType } from '../types/media';

import { MediaModal } from './MediaModal';

/**
 * Props for the MediaPicker component.
 */
export interface MediaPickerProps {
    /** Currently selected media items. */
    value?: Media[];
    /** Called when the selection changes. */
    onChange?: ( media: Media[] ) => void;
    /** Whether multiple items can be selected. */
    multiSelect?: boolean;
    /** Maximum number of selections. */
    maxSelections?: number;
    /** Filter to specific media types. */
    allowedTypes?: MediaType[];
    /** Context identifier. */
    context?: string;
    /** Label for the picker. */
    label?: string;
    /** Hint text below the picker. */
    hint?: string;
    /** Error message. */
    error?: string;
    /** Additional CSS class names. */
    className?: string;
}

/**
 * Lightweight inline media selector for form integration.
 */
export const MediaPicker: React.FC<MediaPickerProps> = ( {
    value         = [],
    onChange,
    multiSelect   = false,
    maxSelections,
    allowedTypes,
    context = 'default',
    label,
    hint,
    error,
    className,
} ) => {
    const [ modalOpen, setModalOpen ] = useState( false );

    const handleSelect = useCallback( ( media: Media[] ) => {
        onChange?.( media );
    }, [ onChange ] );

    const handleRemove = useCallback( ( mediaId: number ) => {
        onChange?.( value.filter( ( m ) => m.id !== mediaId ) );
    }, [ value, onChange ] );

    return (
        <div className={ cn( 'form-control', className ) }>
            { label && (
                <label className="label">
                    <span className="label-text">{ label }</span>
                </label>
            ) }

            { /* Selected media preview */ }
            { value.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    { value.map( ( media ) => (
                        <div
                            key={ media.id }
                            className="relative group w-20 h-20 rounded-lg overflow-hidden ring-1 ring-base-300"
                        >
                            { media.is_image ? (
                                <img
                                    src={ media.url }
                                    alt={ media.alt_text || media.file_name }
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-base-200 flex items-center justify-center">
                                    <span className="text-xs text-base-content/50 text-center px-1">
                                        { media.file_name.split( '.' ).pop()?.toUpperCase() }
                                    </span>
                                </div>
                            ) }

                            { /* Remove button */ }
                            <button
                                type="button"
                                onClick={ () => handleRemove( media.id ) }
                                className="absolute top-1 right-1 w-5 h-5 bg-error text-error-content rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 transition-opacity"
                                aria-label={ `Remove ${ media.title || media.file_name }` }
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ) ) }
                </div>
            ) }

            { /* Select button */ }
            <Button
                color={ value.length > 0 ? 'ghost' : 'neutral' }
                size="sm"
                onClick={ () => setModalOpen( true ) }
            >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={ 2 }>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
                { value.length > 0
                    ? ( multiSelect ? 'Change selection' : 'Change media' )
                    : ( multiSelect ? 'Select media' : 'Select media' ) }
            </Button>

            { hint && ! error && (
                <label className="label">
                    <span className="label-text-alt text-base-content/60">{ hint }</span>
                </label>
            ) }

            { error && (
                <label className="label">
                    <span className="label-text-alt text-error">{ error }</span>
                </label>
            ) }

            { /* Media modal */ }
            <MediaModal
                open={ modalOpen }
                onClose={ () => setModalOpen( false ) }
                onSelect={ handleSelect }
                multiSelect={ multiSelect }
                maxSelections={ maxSelections }
                allowedTypes={ allowedTypes }
                context={ context }
            />
        </div>
    );
};
