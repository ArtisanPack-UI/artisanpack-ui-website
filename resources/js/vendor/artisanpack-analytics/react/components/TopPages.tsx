/**
 * TopPages React component.
 *
 * Displays a sortable table of the most visited pages using
 * @artisanpack-ui/react Table component. Mirrors the Livewire
 * TopPages widget.
 *
 * @since 1.1.0
 */

import React from 'react';
import { Card, Table } from '@artisanpack-ui/react';

import type { TableHeader } from '@artisanpack-ui/react';
import type { TopPageItem } from '../../types';

export interface TopPagesProps {
    /** Array of top page data from the API. */
    topPages: TopPageItem[];
    /** Maximum number of pages to display. */
    limit?: number;
    /** Optional CSS class name for the container. */
    className?: string;
}

const headers: TableHeader<TopPageItem>[] = [
    { key: 'path', label: 'Page', sortable: true },
    { key: 'views', label: 'Views', sortable: true },
    { key: 'unique_views', label: 'Unique Views', sortable: true },
];

export default function TopPages( {
    topPages,
    limit = 10,
    className = '',
}: TopPagesProps ): React.ReactElement {
    const clampedLimit = Math.max( 0, Math.floor( limit ) );
    const displayData = topPages.slice( 0, clampedLimit );

    return (
        <Card title="Top Pages" className={className}>
            <Table<TopPageItem>
                headers={headers}
                rows={displayData}
                striped
            />
        </Card>
    );
}
