/**
 * SiteSelector React component.
 *
 * Provides a dropdown for selecting between multiple sites in
 * multi-tenant environments using @artisanpack-ui/react Select.
 * Mirrors the Livewire SiteSelector widget.
 *
 * @since 1.1.0
 */

import React, { useMemo } from 'react';
import { Select } from '@artisanpack-ui/react';

import type { Site } from '../../types';

export interface SiteSelectorProps {
    /** Array of available sites. */
    sites: Site[];
    /** The currently selected site ID. */
    selectedSiteId?: number | null;
    /** Callback when a site is selected. */
    onSiteChange: ( siteId: number ) => void;
    /** Optional CSS class name for the container. */
    className?: string;
}

export default function SiteSelector( {
    sites,
    selectedSiteId = null,
    onSiteChange,
    className = '',
}: SiteSelectorProps ): React.ReactElement {
    const options = useMemo( () => {
        return sites.map( ( site ) => ( {
            id: String( site.id ),
            name: `${site.name} (${site.domain})`,
        } ) );
    }, [ sites ] );

    return (
        <div className={className}>
            <Select
                label="Site"
                placeholder="Select a site"
                options={options}
                value={selectedSiteId !== null ? String( selectedSiteId ) : ''}
                onChange={( e ) => {
                    const value = ( e.target as HTMLSelectElement ).value;
                    if ( value ) {
                        onSiteChange( parseInt( value, 10 ) );
                    }
                }}
            />
        </div>
    );
}
