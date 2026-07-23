<!--
  TopPages Vue component.

  Displays a sortable table of the most visited pages using
  @artisanpack-ui/vue Table component. Mirrors the Livewire
  TopPages widget.

  @since 1.1.0
-->
<script setup lang="ts">
import { computed } from 'vue';
import { Card, Table } from '@artisanpack-ui/vue';

import type { TableColumn } from '@artisanpack-ui/vue';
import type { TopPageItem } from '../../types';

const props = withDefaults( defineProps<{
    /** Array of top page data from the API. */
    topPages: TopPageItem[];
    /** Maximum number of pages to display. */
    limit?: number;
}>(), {
    limit: 10,
} );

const columns: TableColumn[] = [
    { key: 'path', label: 'Page', sortable: true },
    { key: 'views', label: 'Views', sortable: true },
    { key: 'unique_views', label: 'Unique Views', sortable: true },
];

const displayData = computed( () => {
    const raw = Number( props.limit );
    const clampedLimit = Number.isFinite( raw ) ? Math.max( 0, Math.floor( raw ) ) : 0;

    return props.topPages.slice( 0, clampedLimit );
} );
</script>

<template>
    <Card title="Top Pages">
        <Table
            :columns="columns"
            :rows="displayData"
            striped
            :empty-message="'No page data available for this period.'"
        />
    </Card>
</template>
