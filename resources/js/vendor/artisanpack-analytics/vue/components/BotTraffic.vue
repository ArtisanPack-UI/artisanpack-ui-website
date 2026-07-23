<!--
  BotTraffic Vue component.

  Surfaces bot traffic that is filtered out of the main reports by default:
  total bot visits, the bot share of total traffic, the busiest bot user
  agents, and a bot-only visit trend. Mirrors the Livewire BotTraffic widget.

  @since 1.2.0
-->
<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { Card, Table, Loading } from '@artisanpack-ui/vue';

import { useAnalyticsApi } from '../composables/useAnalyticsApi';

import type { TableColumn } from '@artisanpack-ui/vue';
import type { BotStatsData, DateRangePreset } from '../../types';

const props = withDefaults( defineProps<{
    /** Date range preset to query. Defaults to '30d'. */
    period?: DateRangePreset;
    /** Optional site ID filter. */
    siteId?: number;
    /** Maximum number of bot user agents to display. */
    limit?: number;
    /** Current bot-inclusion state of the main dashboard charts. */
    includeBots?: boolean;
}>(), {
    period: '30d',
    siteId: undefined,
    limit: 10,
    includeBots: false,
} );

const emit = defineEmits<{
    includeBotsChange: [includeBots: boolean];
}>();

const normalizedLimit = computed( () => {
    const raw = Number( props.limit );

    return Number.isFinite( raw ) ? Math.min( 100, Math.max( 1, Math.floor( raw ) ) ) : 10;
} );

const params = reactive( {
    period: props.period,
    site_id: props.siteId,
    limit: normalizedLimit.value,
} );

const { data, loading, error, refresh } = useAnalyticsApi<BotStatsData>( {
    endpoint: 'bots',
    params,
} );

watch(
    () => [ props.period, props.siteId, props.limit ],
    () => {
        params.period = props.period;
        params.site_id = props.siteId;
        params.limit = normalizedLimit.value;
        refresh();
    },
);

const columns: TableColumn[] = [
    { key: 'user_agent', label: 'Bot user agent' },
    { key: 'visits', label: 'Visits' },
];

const numberFormatter = new Intl.NumberFormat();

const botVisits = computed( () => data.value?.bot_visits ?? 0 );
const botPercentage = computed( () => data.value?.bot_percentage ?? 0 );
const trend = computed( () => data.value?.trend ?? [] );
const trendMax = computed( () => Math.max( 1, ...trend.value.map( ( point ) => point.visits ) ) );
const topAgents = computed( () => ( data.value?.top_agents ?? [] ).slice( 0, normalizedLimit.value ) );

function handleIncludeBotsChange( event: Event ): void {
    emit( 'includeBotsChange', ( event.target as HTMLInputElement ).checked );
}
</script>

<template>
    <Card title="Bot Traffic">
        <p class="text-sm text-base-content/60 mb-4">
            Traffic identified as bots and excluded from your reports by default.
        </p>

        <label class="flex items-center gap-2 text-sm cursor-pointer select-none mb-4">
            <input
                type="checkbox"
                class="toggle toggle-sm"
                :checked="props.includeBots"
                aria-label="Include bot traffic in dashboard charts"
                @change="handleIncludeBotsChange"
            />
            <span>Include bot traffic in dashboard charts</span>
        </label>

        <div v-if="loading && ! data" class="flex justify-center py-8">
            <Loading size="lg" />
        </div>
        <p v-else-if="error && ! data" class="text-error text-center py-4">
            {{ error }}
        </p>
        <div v-else class="space-y-6">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="rounded-box bg-base-200 p-4">
                    <div class="text-xs uppercase tracking-wide text-base-content/50">
                        Bot visits
                    </div>
                    <div class="text-2xl font-bold font-mono">
                        {{ numberFormatter.format( botVisits ) }}
                    </div>
                </div>
                <div class="rounded-box bg-base-200 p-4">
                    <div class="text-xs uppercase tracking-wide text-base-content/50">
                        % of total traffic
                    </div>
                    <div class="text-2xl font-bold font-mono">
                        {{ botPercentage.toFixed( 1 ) }}%
                    </div>
                </div>
            </div>

            <div v-if="trend.length > 0">
                <div class="text-xs uppercase tracking-wide text-base-content/50 mb-2">
                    Bot traffic trend
                </div>
                <div
                    class="flex items-end gap-px h-16"
                    role="img"
                    aria-label="Bot visits over time for the selected date range."
                >
                    <div
                        v-for="( point, index ) in trend"
                        :key="`${point.date}-${index}`"
                        class="flex-1 bg-primary/60 rounded-t min-h-[2px]"
                        :style="{ height: `${Math.max( 2, Math.round( ( point.visits / trendMax ) * 100 ) )}%` }"
                        :title="`${point.date}: ${numberFormatter.format( point.visits )}`"
                    />
                </div>
            </div>

            <Table
                :columns="columns"
                :rows="topAgents"
                striped
                :empty-message="'No bot traffic detected for this period.'"
            />
        </div>
    </Card>
</template>
