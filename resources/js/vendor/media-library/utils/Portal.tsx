/**
 * ArtisanPack UI Media Library - Portal Utility
 *
 * Renders children into document.body via React createPortal.
 * Used to escape overflow-hidden parent containers so modals
 * cover the full viewport.
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/**
 * Props for the Portal component.
 */
export interface PortalProps {
    children: ReactNode;
}

/**
 * Renders children into document.body to escape layout constraints.
 */
export function Portal( { children }: PortalProps ): React.ReactPortal {
    return createPortal( children, document.body );
}
