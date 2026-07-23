/**
 * ConsentBanner React component.
 *
 * A GDPR/CCPA-compliant cookie consent banner with accept, reject, and
 * customize options. Integrates with the consent API via the useConsent
 * hook and uses @artisanpack-ui/react Button and Card components.
 *
 * @since 1.1.0
 */

import React, { useEffect, useState } from 'react';
import { Button, Card, Toggle } from '@artisanpack-ui/react';

import { useConsent } from '../hooks/useConsent';

import type { UseConsentOptions } from '../hooks/useConsent';

export interface ConsentBannerProps extends UseConsentOptions {
    /** Banner position on screen. Defaults to 'bottom'. */
    position?: 'top' | 'bottom';
    /** Title text for the banner. */
    title?: string;
    /** Description text displayed below the title. */
    description?: string;
    /** Label for the accept all button. */
    acceptLabel?: string;
    /** Label for the reject all button. */
    rejectLabel?: string;
    /** Label for the customize button. */
    customizeLabel?: string;
    /** Label for the save preferences button. */
    saveLabel?: string;
    /** Callback invoked after consent is saved. */
    onConsentSaved?: ( categories: Record<string, boolean> ) => void;
    /** Optional CSS class name for the container. */
    className?: string;
}

export default function ConsentBanner( {
    position = 'bottom',
    title = 'Privacy Settings',
    description = 'We use cookies to understand how you use our website and improve your experience.',
    acceptLabel = 'Accept All',
    rejectLabel = 'Reject All',
    customizeLabel = 'Customize',
    saveLabel = 'Save Preferences',
    onConsentSaved,
    className = '',
    ...consentOptions
}: ConsentBannerProps ): React.ReactElement | null {
    const {
        loading,
        consentRequired,
        categories,
        acceptAll,
        rejectAll,
        updateConsent,
    } = useConsent( consentOptions );

    const [ visible, setVisible ] = useState( false );
    const [ showDetails, setShowDetails ] = useState( false );
    const [ localCategories, setLocalCategories ] = useState<Record<string, boolean>>( {} );

    // Show the banner if consent is required and no consent has been given yet
    useEffect( () => {
        if ( ! consentRequired ) {
            return;
        }

        const stored = typeof localStorage !== 'undefined'
            ? localStorage.getItem( 'ap_analytics_consent' )
            : null;

        if ( ! stored ) {
            setVisible( true );
        }
    }, [ consentRequired ] );

    // Sync local toggle state with API categories
    useEffect( () => {
        const state: Record<string, boolean> = {};

        for ( const [ key, item ] of Object.entries( categories ) ) {
            state[ key ] = item.required || item.granted;
        }

        setLocalCategories( state );
    }, [ categories ] );

    if ( ! visible ) {
        return null;
    }

    const handleAcceptAll = async (): Promise<void> => {
        try {
            await acceptAll();
            setVisible( false );
            onConsentSaved?.( Object.fromEntries(
                Object.keys( categories ).map( ( key ) => [ key, true ] ),
            ) );
        } catch ( err ) {
            console.error( 'Failed to accept all consent:', err );
        }
    };

    const handleRejectAll = async (): Promise<void> => {
        try {
            await rejectAll();
            setVisible( false );

            const result: Record<string, boolean> = {};

            for ( const [ key, item ] of Object.entries( categories ) ) {
                result[ key ] = item.required;
            }

            onConsentSaved?.( result );
        } catch ( err ) {
            console.error( 'Failed to reject all consent:', err );
        }
    };

    const handleSavePreferences = async (): Promise<void> => {
        try {
            await updateConsent( localCategories );
            setVisible( false );
            onConsentSaved?.( { ...localCategories } );
        } catch ( err ) {
            console.error( 'Failed to save consent preferences:', err );
        }
    };

    const handleToggleCategory = ( key: string, value: boolean ): void => {
        if ( categories[ key ]?.required ) {
            return;
        }

        setLocalCategories( ( prev ) => ( { ...prev, [ key ]: value } ) );
    };

    const positionClasses = position === 'bottom'
        ? 'bottom-0'
        : 'top-0';

    return (
        <div
            className={`fixed ${positionClasses} inset-x-0 z-50 p-4 ${className}`.trim()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="consent-banner-title"
        >
            <div className="mx-auto max-w-4xl">
                <Card>
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3
                                id="consent-banner-title"
                                className="text-lg font-semibold"
                            >
                                {title}
                            </h3>
                            <p className="text-sm opacity-70 mt-1">
                                {description}
                            </p>
                        </div>
                        <Button
                            color="ghost"
                            size="sm"
                            onClick={() => setShowDetails( ! showDetails )}
                            aria-expanded={showDetails}
                            aria-controls="consent-details"
                        >
                            {showDetails ? 'Hide Details' : customizeLabel}
                        </Button>
                    </div>

                    {showDetails && (
                        <div id="consent-details" className="space-y-3 mb-6">
                            {Object.entries( categories ).map( ( [ key, item ] ) => (
                                <label
                                    key={key}
                                    className="flex items-start gap-3 p-3 rounded-lg bg-base-200/50"
                                >
                                    <div className="mt-1">
                                        <Toggle
                                            checked={localCategories[ key ] ?? false}
                                            onChange={( e ) => handleToggleCategory( key, e.target.checked )}
                                            disabled={item.required}
                                            size="sm"
                                            color="primary"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <span className="font-medium">
                                            {item.name}
                                            {item.required && (
                                                <span className="text-xs opacity-50 ml-1">
                                                    (Required)
                                                </span>
                                            )}
                                        </span>
                                        <p className="text-sm opacity-70 mt-0.5">
                                            {item.description}
                                        </p>
                                    </div>
                                </label>
                            ) )}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-3">
                        <Button
                            color="ghost"
                            size="sm"
                            onClick={handleRejectAll}
                            disabled={loading}
                        >
                            {rejectLabel}
                        </Button>
                        {showDetails && (
                            <Button
                                color="neutral"
                                size="sm"
                                onClick={handleSavePreferences}
                                disabled={loading}
                            >
                                {saveLabel}
                            </Button>
                        )}
                        <Button
                            color="primary"
                            size="sm"
                            onClick={handleAcceptAll}
                            disabled={loading}
                        >
                            {acceptLabel}
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
}
