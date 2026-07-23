/**
 * ConsentPreferences React component.
 *
 * A detailed consent preferences panel that allows users to individually
 * manage tracking categories. Uses @artisanpack-ui/react Card, Button,
 * Toggle, and Badge components. Can be displayed inline or within a modal.
 *
 * @since 1.1.0
 */

import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, Toggle } from '@artisanpack-ui/react';

import { useConsent } from '../hooks/useConsent';

import type { UseConsentOptions } from '../hooks/useConsent';

export interface ConsentPreferencesProps extends UseConsentOptions {
    /** Title text for the preferences panel. */
    title?: string;
    /** Description text displayed below the title. */
    description?: string;
    /** Label for the save button. */
    saveLabel?: string;
    /** Label for the accept all button. */
    acceptAllLabel?: string;
    /** Label for the reject all button. */
    rejectAllLabel?: string;
    /** Whether to show accept/reject all buttons. Defaults to true. */
    showBulkActions?: boolean;
    /** Callback invoked after preferences are saved. */
    onSaved?: ( categories: Record<string, boolean> ) => void;
    /** Optional CSS class name for the container. */
    className?: string;
}

export default function ConsentPreferences( {
    title = 'Cookie Preferences',
    description = 'Manage your cookie and tracking preferences below. Required cookies cannot be disabled.',
    saveLabel = 'Save Preferences',
    acceptAllLabel = 'Accept All',
    rejectAllLabel = 'Reject All',
    showBulkActions = true,
    onSaved,
    className = '',
    ...consentOptions
}: ConsentPreferencesProps ): React.ReactElement {
    const {
        loading,
        categories,
        acceptAll,
        rejectAll,
        updateConsent,
    } = useConsent( consentOptions );

    const [ localCategories, setLocalCategories ] = useState<Record<string, boolean>>( {} );

    useEffect( () => {
        const state: Record<string, boolean> = {};

        for ( const [ key, item ] of Object.entries( categories ) ) {
            state[ key ] = item.required || item.granted;
        }

        setLocalCategories( state );
    }, [ categories ] );

    const handleToggle = ( key: string, value: boolean ): void => {
        if ( categories[ key ]?.required ) {
            return;
        }

        setLocalCategories( ( prev ) => ( { ...prev, [ key ]: value } ) );
    };

    const handleSave = async (): Promise<void> => {
        try {
            await updateConsent( localCategories );
            onSaved?.( { ...localCategories } );
        } catch ( err ) {
            console.error( 'Failed to save consent preferences:', err );
        }
    };

    const handleAcceptAll = async (): Promise<void> => {
        try {
            await acceptAll();
            onSaved?.( Object.fromEntries(
                Object.keys( categories ).map( ( key ) => [ key, true ] ),
            ) );
        } catch ( err ) {
            console.error( 'Failed to accept all consent:', err );
        }
    };

    const handleRejectAll = async (): Promise<void> => {
        try {
            await rejectAll();

            const result: Record<string, boolean> = {};

            for ( const [ key, item ] of Object.entries( categories ) ) {
                result[ key ] = item.required;
            }

            onSaved?.( result );
        } catch ( err ) {
            console.error( 'Failed to reject all consent:', err );
        }
    };

    return (
        <Card className={className}>
            <div className="mb-6">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm opacity-70 mt-1">{description}</p>
            </div>

            <div className="space-y-4 mb-6">
                {Object.entries( categories ).map( ( [ key, item ] ) => (
                    <div
                        key={key}
                        className="flex items-start gap-4 p-4 rounded-lg bg-base-200/50"
                    >
                        <div className="mt-0.5">
                            <Toggle
                                checked={localCategories[ key ] ?? false}
                                onChange={( e ) => handleToggle( key, e.target.checked )}
                                disabled={item.required}
                                aria-labelledby={`consent-label-${key}`}
                                color="primary"
                            />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span id={`consent-label-${key}`} className="font-medium">{item.name}</span>
                                {item.required && (
                                    <Badge color="neutral" size="sm">Required</Badge>
                                )}
                                {item.granted && ! item.required && (
                                    <Badge color="success" size="sm">Granted</Badge>
                                )}
                            </div>
                            <p className="text-sm opacity-70 mt-1">{item.description}</p>
                            {item.granted_at && ! isNaN( Date.parse( item.granted_at ) ) && (
                                <p className="text-xs opacity-50 mt-1">
                                    Granted on {new Date( item.granted_at ).toISOString().slice( 0, 10 )}
                                </p>
                            )}
                        </div>
                    </div>
                ) )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
                {showBulkActions && (
                    <>
                        <Button
                            color="ghost"
                            size="sm"
                            onClick={handleRejectAll}
                            disabled={loading}
                        >
                            {rejectAllLabel}
                        </Button>
                        <Button
                            color="ghost"
                            size="sm"
                            onClick={handleAcceptAll}
                            disabled={loading}
                        >
                            {acceptAllLabel}
                        </Button>
                    </>
                )}
                <Button
                    color="primary"
                    size="sm"
                    onClick={handleSave}
                    disabled={loading}
                >
                    {saveLabel}
                </Button>
            </div>
        </Card>
    );
}
