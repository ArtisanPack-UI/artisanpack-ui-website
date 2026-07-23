<!--
  TrafficSources Vue component.

  Displays a table of traffic sources with session and visitor counts
  using @artisanpack-ui/vue Table. Mirrors the Livewire TrafficSources
  widget.

  @since 1.1.0
-->
<script setup lang="ts">
import { computed } from 'vue';
import { Card, Table } from '@artisanpack-ui/vue';

import type { TableColumn } from '@artisanpack-ui/vue';
import type { TrafficSourceItem } from '../../types';

const props = withDefaults( defineProps<{
    /** Array of traffic source data from the API. */
    trafficSources: TrafficSourceItem[];
    /** Maximum number of sources to display. */
    limit?: number;
}>(), {
    limit: 10,
} );

const columns: TableColumn[] = [
    { key: 'source', label: 'Source', sortable: true },
    { key: 'medium', label: 'Medium', sortable: true },
    { key: 'sessions', label: 'Sessions', sortable: true },
    { key: 'visitors', label: 'Visitors', sortable: true },
    { key: 'percentage', label: '%' },
];

const totalSessions = computed(
    () => props.trafficSources.reduce( ( sum, s ) => sum + s.sessions, 0 ),
);

const displayData = computed( () => {
    const clampedLimit = Math.max( 0, Math.floor( props.limit ) );

    return props.trafficSources.slice( 0, clampedLimit ).map( ( source ) => ( {
        ...source,
        source: source.source || '(direct)',
        medium: source.medium || '(none)',
        percentage: totalSessions.value > 0
            ? `${( ( source.sessions / totalSessions.value ) * 100 ).toFixed( 1 )}%`
            : '0.0%',
    } ) );
} );
</script>

<template>
    <Card title="Traffic Sources">
        <Table
            :columns="columns"
            :rows="displayData"
            striped
            :empty-message="'No traffic source data available for this period.'"
        />
    </Card>
</template>
