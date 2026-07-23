<!--
  RealtimeVisitors Vue component.

  Displays the current number of active visitors with optional polling
  for live updates using @artisanpack-ui/vue Stat, Card, Badge, and
  Loading. Mirrors the Livewire RealtimeVisitors widget.

  @since 1.1.0
-->
<script setup lang="ts">
import { computed, onUnmounted, ref, watchEffect } from 'vue';
import { Card, Stat, Badge, Loading } from '@artisanpack-ui/vue';

import type { RealtimeData } from '../../types';

const props = withDefaults( defineProps<{
    /** Initial realtime data (e.g. from Inertia page props). */
    initialData?: RealtimeData;
    /** Polling interval in milliseconds. Defaults to 10000 (10s). Set to 0 to disable. */
    pollInterval?: number;
    /** Number of minutes of activity to consider. Defaults to 5. */
    minutes?: number;
}>(), {
    initialData: undefined,
    pollInterval: 10000,
    minutes: 5,
} );

/**
 * Normalize a raw API payload into a safe RealtimeData shape.
 */
function normalizeRealtimeData( payload: unknown ): RealtimeData {
    if ( payload && typeof payload === 'object' ) {
        const obj = payload as Record<string, unknown>;

        return {
            active_visitors: typeof obj.active_visitors === 'number' ? obj.active_visitors : 0,
            recent_pageviews: Array.isArray( obj.recent_pageviews )
                ? obj.recent_pageviews.map( ( pv: Record<string, unknown> ) => ( {
                    path: typeof pv?.path === 'string' ? pv.path : '',
                    timestamp: typeof pv?.timestamp === 'string' ? pv.timestamp : '',
                } ) )
                : [],
        };
    }

    return { active_visitors: 0, recent_pageviews: [] };
}

const data = ref<RealtimeData | null>( props.initialData ?? null );
const previousCount = ref<number | null>( props.initialData?.active_visitors ?? null );
const loading = ref( ! props.initialData );
const error = ref<string | null>( null );
let abortController: AbortController | null = null;

async function fetchRealtime(): Promise<void> {
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;

    try {
        const response = await fetch(
            `/api/analytics/realtime?minutes=${props.minutes}`,
            {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                signal: controller.signal,
            },
        );

        if ( ! response.ok ) {
            throw new Error( `HTTP ${response.status}` );
        }

        const json = await response.json();
        const realtimeData = normalizeRealtimeData( json.data ?? json );

        if ( data.value ) {
            previousCount.value = data.value.active_visitors;
        }

        data.value = realtimeData;
        error.value = null;
    } catch ( err ) {
        if ( err instanceof DOMException && err.name === 'AbortError' ) {
            return;
        }

        error.value = err instanceof Error ? err.message : 'Failed to fetch realtime data';
    } finally {
        if ( ! controller.signal.aborted ) {
            loading.value = false;
        }
    }
}

if ( ! props.initialData ) {
    fetchRealtime();
}

let intervalId: ReturnType<typeof setInterval> | null = null;

if ( props.pollInterval > 0 ) {
    intervalId = setInterval( fetchRealtime, props.pollInterval );
}

onUnmounted( () => {
    abortController?.abort();

    if ( intervalId ) {
        clearInterval( intervalId );
    }
} );

const activeVisitors = computed( () => data.value?.active_visitors ?? 0 );
const trend = computed( () =>
    previousCount.value !== null ? activeVisitors.value - previousCount.value : 0,
);
const hasTrend = computed( () => previousCount.value !== null && trend.value !== 0 );
const isActive = computed( () => activeVisitors.value > 0 );

const changeDisplay = computed( () => {
    if ( ! hasTrend.value ) {
        return undefined;
    }

    const pct = ( trend.value / Math.max( previousCount.value!, 1 ) ) * 100;
    const sign = pct >= 0 ? '+' : '';

    return `${sign}${pct.toFixed( 1 )}%`;
} );

const changeDir = computed<'up' | 'down' | 'neutral'>( () => {
    if ( ! hasTrend.value ) {
        return 'neutral';
    }

    return trend.value > 0 ? 'up' : 'down';
} );
</script>

<template>
    <Card title="Realtime Visitors">
        <template #menu>
            <Badge
                :color="isActive ? 'success' : 'neutral'"
                :value="isActive ? 'Live' : 'Idle'"
                size="sm"
            />
        </template>

        <div v-if="loading" class="flex justify-center py-8">
            <Loading size="lg" />
        </div>
        <p v-else-if="error" class="text-error text-center py-4">
            {{ error }}
        </p>
        <div v-else class="space-y-4">
            <Stat
                title="Active Now"
                :value="new Intl.NumberFormat().format( activeVisitors )"
                :change="changeDisplay"
                :change-direction="changeDir"
                description="from last poll"
            />

            <div v-if="data?.recent_pageviews && data.recent_pageviews.length > 0">
                <h4 class="text-sm font-semibold mb-2">Recent Activity</h4>
                <div class="space-y-1">
                    <div
                        v-for="( pv, index ) in data.recent_pageviews.slice( 0, 5 )"
                        :key="`${pv.path}-${pv.timestamp}-${index}`"
                        class="flex items-center justify-between text-sm"
                    >
                        <span class="font-mono text-base-content/70 truncate">
                            {{ pv.path }}
                        </span>
                        <Badge
                            :value="new Date( pv.timestamp ).toLocaleTimeString()"
                            size="xs"
                            ghost
                        />
                    </div>
                </div>
            </div>
        </div>
    </Card>
</template>
