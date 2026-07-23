<!--
  ConsentPreferences Vue component.

  A detailed consent preferences panel that allows users to individually
  manage tracking categories. Uses @artisanpack-ui/vue Card, Button,
  Toggle, and Badge components. Can be displayed inline or within a modal.

  @since 1.1.0
-->
<script setup lang="ts">
import { ref, watch } from 'vue';
import { Badge, Button, Card, Toggle } from '@artisanpack-ui/vue';

import { useConsent } from '../composables/useConsent';

import type { UseConsentOptions } from '../composables/useConsent';

interface Props extends UseConsentOptions {
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
}

const props = withDefaults( defineProps<Props>(), {
    title: 'Cookie Preferences',
    description: 'Manage your cookie and tracking preferences below. Required cookies cannot be disabled.',
    saveLabel: 'Save Preferences',
    acceptAllLabel: 'Accept All',
    rejectAllLabel: 'Reject All',
    showBulkActions: true,
    apiPrefix: 'api/analytics',
    fetchOnMount: true,
    initialConsentRequired: false,
    initialCategories: () => ( {} ),
} );

const emit = defineEmits<{
    saved: [categories: Record<string, boolean>];
}>();

const {
    loading,
    categories,
    acceptAll,
    rejectAll,
    updateConsent,
} = useConsent( {
    apiPrefix: props.apiPrefix,
    fetchOnMount: props.fetchOnMount,
    initialCategories: props.initialCategories,
    initialConsentRequired: props.initialConsentRequired,
} );

const localCategories = ref<Record<string, boolean>>( {} );

watch( categories, ( cats ) => {
    const state: Record<string, boolean> = {};

    for ( const [ key, item ] of Object.entries( cats ) ) {
        state[ key ] = item.required || item.granted;
    }

    localCategories.value = state;
}, { immediate: true } );

function handleToggle( key: string, value: boolean ): void {
    if ( categories.value[ key ]?.required ) {
        return;
    }

    localCategories.value[ key ] = value;
}

async function handleSave(): Promise<void> {
    try {
        await updateConsent( localCategories.value );
        emit( 'saved', { ...localCategories.value } );
    } catch ( err ) {
        console.error( 'Failed to save consent preferences:', err );
    }
}

async function handleAcceptAll(): Promise<void> {
    try {
        await acceptAll();
        emit( 'saved', Object.fromEntries(
            Object.keys( categories.value ).map( ( key ) => [ key, true ] ),
        ) );
    } catch ( err ) {
        console.error( 'Failed to accept all consent:', err );
    }
}

async function handleRejectAll(): Promise<void> {
    try {
        await rejectAll();

        const result: Record<string, boolean> = {};

        for ( const [ key, item ] of Object.entries( categories.value ) ) {
            result[ key ] = item.required;
        }

        emit( 'saved', result );
    } catch ( err ) {
        console.error( 'Failed to reject all consent:', err );
    }
}

function formatDate( dateStr: string ): string {
    const d = new Date( dateStr );

    if ( isNaN( d.getTime() ) ) {
        return '';
    }

    return d.toISOString().slice( 0, 10 );
}
</script>

<template>
    <Card>
        <div class="mb-6">
            <h3 class="text-lg font-semibold">{{ props.title }}</h3>
            <p class="text-sm opacity-70 mt-1">{{ props.description }}</p>
        </div>

        <div class="space-y-4 mb-6">
            <div
                v-for="( item, key ) in categories"
                :key="key"
                class="flex items-start gap-4 p-4 rounded-lg bg-base-200/50"
            >
                <div class="mt-0.5">
                    <Toggle
                        :model-value="localCategories[ key as string ] ?? false"
                        :disabled="item.required"
                        :aria-labelledby="`consent-label-${key}`"
                        color="primary"
                        @update:model-value="handleToggle( key as string, $event as boolean )"
                    />
                </div>
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <span :id="`consent-label-${key}`" class="font-medium">{{ item.name }}</span>
                        <Badge v-if="item.required" color="neutral" size="sm">
                            Required
                        </Badge>
                        <Badge v-else-if="item.granted" color="success" size="sm">
                            Granted
                        </Badge>
                    </div>
                    <p class="text-sm opacity-70 mt-1">{{ item.description }}</p>
                    <p
                        v-if="item.granted_at"
                        class="text-xs opacity-50 mt-1"
                    >
                        Granted on {{ formatDate( item.granted_at ) }}
                    </p>
                </div>
            </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-3">
            <template v-if="props.showBulkActions">
                <Button
                    color="ghost"
                    size="sm"
                    :disabled="loading"
                    @click="handleRejectAll"
                >
                    {{ props.rejectAllLabel }}
                </Button>
                <Button
                    color="ghost"
                    size="sm"
                    :disabled="loading"
                    @click="handleAcceptAll"
                >
                    {{ props.acceptAllLabel }}
                </Button>
            </template>
            <Button
                color="primary"
                size="sm"
                :disabled="loading"
                @click="handleSave"
            >
                {{ props.saveLabel }}
            </Button>
        </div>
    </Card>
</template>
