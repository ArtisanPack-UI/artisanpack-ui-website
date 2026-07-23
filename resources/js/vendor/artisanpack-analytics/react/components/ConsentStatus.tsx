/**
 * ConsentStatus React component.
 *
 * A small indicator showing the current consent state. Can be used as a
 * persistent UI element to let users revisit their consent preferences.
 * Uses @artisanpack-ui/react Badge and Button components.
 *
 * @since 1.1.0
 */

import React from 'react';
import { Badge, Button } from '@artisanpack-ui/react';

import { useConsent } from '../hooks/useConsent';

import type { UseConsentOptions } from '../hooks/useConsent';

export interface ConsentStatusProps extends UseConsentOptions {
    /** Label text for the status indicator. */
    label?: string;
    /** Callback when the user clicks to manage preferences. */
    onManageClick?: () => void;
    /** Label for the manage button. */
    manageLabel?: string;
    /** Whether to show the manage button. Defaults to true. */
    showManageButton?: boolean;
    /** Optional CSS class name for the container. */
    className?: string;
}

export default function ConsentStatus( {
    label = 'Privacy',
    onManageClick,
    manageLabel = 'Manage',
    showManageButton = true,
    className = '',
    ...consentOptions
}: ConsentStatusProps ): React.ReactElement | null {
    const { consentRequired, categories } = useConsent( consentOptions );

    if ( ! consentRequired ) {
        return null;
    }

    const totalCategories = Object.keys( categories ).length;
    const grantedCount = Object.values( categories ).filter( ( c ) => c.granted ).length;
    const allGranted = totalCategories > 0 && grantedCount === totalCategories;
    const noneGranted = totalCategories > 0 && grantedCount === 0;

    let statusColor: 'success' | 'warning' | 'error' = 'warning';
    let statusText = `${grantedCount}/${totalCategories}`;

    if ( allGranted ) {
        statusColor = 'success';
        statusText = 'All accepted';
    } else if ( noneGranted ) {
        statusColor = 'error';
        statusText = 'None accepted';
    }

    return (
        <div className={`inline-flex items-center gap-2 ${className}`.trim()}>
            <span className="text-sm font-medium">{label}</span>
            <Badge color={statusColor} size="sm">{statusText}</Badge>
            {showManageButton && onManageClick && (
                <Button
                    color="ghost"
                    size="xs"
                    onClick={onManageClick}
                >
                    {manageLabel}
                </Button>
            )}
        </div>
    );
}
