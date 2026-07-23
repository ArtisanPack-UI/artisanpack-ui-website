<!--
  ConsentBanner Vue component.

  A GDPR/CCPA-compliant cookie consent banner with accept, reject, and
  customize options. Integrates with the consent API via the useConsent
  composable and uses @artisanpack-ui/vue Button, Card, and Toggle
  components.

  @since 1.1.0
-->
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { Button, Card, Toggle } from '@artisanpack-ui/vue';

import { useConsent } from '../composables/useConsent';

import type { UseConsentOptions } from '../composables/useConsent';

interface Props extends UseConsentOptions {
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
}

const props = withDefaults( defineProps<Props>(), {
    position: 'bottom',
    title: 'Privacy Settings',
    description: 'We use cookies to understand how you use our website and improve your experience.',
    acceptLabel: 'Accept All',
    rejectLabel: 'Reject All',
    customizeLabel: 'Customize',
    saveLabel: 'Save Preferences',
    apiPrefix: 'api/analytics',
    fetchOnMount: true,
    initialConsentRequired: false,
    initialCategories: () => ( {} ),
} );

const emit = defineEmits<{
    consentSaved: [categories: Record<string, boolean>];
}>();

const {
    loading,
    consentRequired,
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

const visible = ref( false );
const showDetails = ref( false );
const localCategories = ref<Record<string, boolean>>( {} );

onMounted( () => {
    if ( ! consentRequired.value ) {
        return;
    }

    const stored = typeof localStorage !== 'undefined'
        ? localStorage.getItem( 'ap_analytics_consent' )
        : null;

    if ( ! stored ) {
        visible.value = true;
    }
} );

watch( () => consentRequired.value, ( required ) => {
    if ( ! required ) {
        return;
    }

    const stored = typeof localStorage !== 'undefined'
        ? localStorage.getItem( 'ap_analytics_consent' )
        : null;

    if ( ! stored ) {
        visible.value = true;
    }
} );

watch( categories, ( cats ) => {
    const state: Record<string, boolean> = {};

    for ( const [ key, item ] of Object.entries( cats ) ) {
        state[ key ] = item.required || item.granted;
    }

    localCategories.value = state;
}, { immediate: true } );

async function handleAcceptAll(): Promise<void> {
    await acceptAll();
    visible.value = false;
    emit( 'consentSaved', Object.fromEntries(
        Object.keys( categories.value ).map( ( key ) => [ key, true ] ),
    ) );
}

async function handleRejectAll(): Promise<void> {
    await rejectAll();
    visible.value = false;

    const result: Record<string, boolean> = {};

    for ( const [ key, item ] of Object.entries( categories.value ) ) {
        result[ key ] = item.required;
    }

    emit( 'consentSaved', result );
}

async function handleSavePreferences(): Promise<void> {
    await updateConsent( localCategories.value );
    visible.value = false;
    emit( 'consentSaved', { ...localCategories.value } );
}

function handleToggleCategory( key: string, value: boolean ): void {
    if ( categories.value[ key ]?.required ) {
        return;
    }

    localCategories.value[ key ] = value;
}
</script>

<template>
    <div
        v-if="visible"
        :class="[
            'fixed inset-x-0 z-50 p-4',
            props.position === 'bottom' ? 'bottom-0' : 'top-0',
        ]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-banner-title"
    >
        <div class="mx-auto max-w-4xl">
            <Card>
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <h3
                            id="consent-banner-title"
                            class="text-lg font-semibold"
                        >
                            {{ props.title }}
                        </h3>
                        <p class="text-sm opacity-70 mt-1">
                            {{ props.description }}
                        </p>
                    </div>
                    <Button
                        color="ghost"
                        size="sm"
                        :aria-expanded="showDetails"
                        aria-controls="consent-details"
                        @click="showDetails = ! showDetails"
                    >
                        {{ showDetails ? 'Hide Details' : props.customizeLabel }}
                    </Button>
                </div>

                <div v-if="showDetails" id="consent-details" class="space-y-3 mb-6">
                    <label
                        v-for="( item, key ) in categories"
                        :key="key"
                        class="flex items-start gap-3 p-3 rounded-lg bg-base-200/50"
                    >
                        <div class="mt-1">
                            <Toggle
                                :model-value="localCategories[ key as string ] ?? false"
                                :disabled="item.required"
                                size="sm"
                                color="primary"
                                @update:model-value="handleToggleCategory( key as string, $event as boolean )"
                            />
                        </div>
                        <div class="flex-1">
                            <span class="font-medium">
                                {{ item.name }}
                                <span v-if="item.required" class="text-xs opacity-50 ml-1">
                                    (Required)
                                </span>
                            </span>
                            <p class="text-sm opacity-70 mt-0.5">
                                {{ item.description }}
                            </p>
                        </div>
                    </label>
                </div>

                <div class="flex flex-wrap items-center justify-end gap-3">
                    <Button
                        color="ghost"
                        size="sm"
                        :disabled="loading"
                        @click="handleRejectAll"
                    >
                        {{ props.rejectLabel }}
                    </Button>
                    <Button
                        v-if="showDetails"
                        color="neutral"
                        size="sm"
                        :disabled="loading"
                        @click="handleSavePreferences"
                    >
                        {{ props.saveLabel }}
                    </Button>
                    <Button
                        color="primary"
                        size="sm"
                        :disabled="loading"
                        @click="handleAcceptAll"
                    >
                        {{ props.acceptLabel }}
                    </Button>
                </div>
            </Card>
        </div>
    </div>
</template>
