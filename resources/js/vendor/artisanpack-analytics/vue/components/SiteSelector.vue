<!--
  SiteSelector Vue component.

  Provides a dropdown for selecting between multiple sites in
  multi-tenant environments using @artisanpack-ui/vue Select.
  Mirrors the Livewire SiteSelector widget.

  @since 1.1.0
-->
<script setup lang="ts">
import { computed } from 'vue';
import { Select } from '@artisanpack-ui/vue';

import type { Site } from '../../types';

const props = defineProps<{
    /** Array of available sites. */
    sites: Site[];
    /** The currently selected site ID. */
    selectedSiteId?: number | null;
}>();

const emit = defineEmits<{
    siteChange: [siteId: number | null];
}>();

const options = computed( () => {
    return props.sites.map( ( site ) => ( {
        id: String( site.id ),
        name: `${site.name} (${site.domain})`,
    } ) );
} );

const selectedValue = computed( () =>
    props.selectedSiteId !== null && props.selectedSiteId !== undefined
        ? String( props.selectedSiteId )
        : '',
);

function handleChange( event: Event ): void {
    const value = ( event.target as HTMLSelectElement ).value;

    if ( value ) {
        emit( 'siteChange', parseInt( value, 10 ) );
    } else {
        emit( 'siteChange', null );
    }
}
</script>

<template>
    <Select
        label="Site"
        placeholder="Select a site"
        :options="options"
        :model-value="selectedValue"
        @change="handleChange"
    />
</template>
