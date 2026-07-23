<!--
  ConsentStatus Vue component.

  A small indicator showing the current consent state. Can be used as a
  persistent UI element to let users revisit their consent preferences.
  Uses @artisanpack-ui/vue Badge and Button components.

  @since 1.1.0
-->
<script setup lang="ts">
import { computed } from 'vue';
import { Badge, Button } from '@artisanpack-ui/vue';

import { useConsent } from '../composables/useConsent';

import type { UseConsentOptions } from '../composables/useConsent';

interface Props extends UseConsentOptions {
    /** Label text for the status indicator. */
    label?: string;
    /** Label for the manage button. */
    manageLabel?: string;
    /** Whether to show the manage button. Defaults to true. */
    showManageButton?: boolean;
}

const props = withDefaults( defineProps<Props>(), {
    label: 'Privacy',
    manageLabel: 'Manage',
    showManageButton: true,
    apiPrefix: 'api/analytics',
    fetchOnMount: true,
    initialConsentRequired: false,
    initialCategories: () => ( {} ),
} );

const emit = defineEmits<{
    manageClick: [];
}>();

const { consentRequired, categories } = useConsent( {
    apiPrefix: props.apiPrefix,
    fetchOnMount: props.fetchOnMount,
    initialCategories: props.initialCategories,
    initialConsentRequired: props.initialConsentRequired,
} );

const totalCategories = computed( () => Object.keys( categories.value ).length );
const grantedCount = computed( () =>
    Object.values( categories.value ).filter( ( c ) => c.granted ).length,
);
const allGranted = computed( () =>
    totalCategories.value > 0 && grantedCount.value === totalCategories.value,
);
const noneGranted = computed( () =>
    totalCategories.value > 0 && grantedCount.value === 0,
);

const statusColor = computed( (): 'success' | 'warning' | 'error' => {
    if ( allGranted.value ) {
        return 'success';
    }

    if ( noneGranted.value ) {
        return 'error';
    }

    return 'warning';
} );

const statusText = computed( () => {
    if ( allGranted.value ) {
        return 'All accepted';
    }

    if ( noneGranted.value ) {
        return 'None accepted';
    }

    return `${grantedCount.value}/${totalCategories.value}`;
} );
</script>

<template>
    <div
        v-if="consentRequired"
        class="inline-flex items-center gap-2"
    >
        <span class="text-sm font-medium">{{ props.label }}</span>
        <Badge :color="statusColor" size="sm">
            {{ statusText }}
        </Badge>
        <Button
            v-if="props.showManageButton"
            color="ghost"
            size="xs"
            @click="emit( 'manageClick' )"
        >
            {{ props.manageLabel }}
        </Button>
    </div>
</template>
