<!--
  AnalyticsDashboard Vue component.

  Main dashboard layout composing all analytics widgets with date range
  selection and tab navigation using @artisanpack-ui/vue Card, Tabs,
  Select, and Grid. Designed for use with Inertia.js page props.
  Mirrors the Livewire AnalyticsDashboard component.

  @since 1.1.0
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { Card, Tabs, Select, Grid } from '@artisanpack-ui/vue';

import type { TabItem } from '@artisanpack-ui/vue';
import type { TopPageItem, TrafficSourceItem, StatsComparison } from '../../types';

import StatsCards from '../components/StatsCards.vue';
import TopPages from '../components/TopPages.vue';
import TrafficSources from '../components/TrafficSources.vue';
import VisitorsChart from '../components/VisitorsChart.vue';

import type { ChartDataPoint } from '../components/VisitorsChart.vue';

interface Stats {
    pageviews: number;
    visitors: number;
    sessions: number;
    bounce_rate: number;
    avg_session_duration: number;
    pages_per_session?: number;
    realtime_visitors?: number;
    comparison?: StatsComparison | null;
}

const props = withDefaults( defineProps<{
    /** Statistics data for the StatsCards widget. */
    stats: Stats;
    /** Time-series chart data points. */
    chartData: ChartDataPoint[];
    /** Top pages data. */
    topPages: TopPageItem[];
    /** Traffic sources data. */
    trafficSources: TrafficSourceItem[];
    /** Active date range preset value. */
    dateRangePreset?: string;
    /** Available date range presets. */
    dateRangePresets?: Record<string, string>;
    /** Whether bot traffic is included. Bots are excluded by default. */
    includeBots?: boolean;
}>(), {
    dateRangePreset: '30d',
    includeBots: false,
    dateRangePresets: () => ( {
        today: 'Today',
        yesterday: 'Yesterday',
        '7d': 'Last 7 days',
        '30d': 'Last 30 days',
        '90d': 'Last 90 days',
        this_week: 'This week',
        last_week: 'Last week',
        this_month: 'This month',
        last_month: 'Last month',
        this_year: 'This year',
    } ),
} );

const emit = defineEmits<{
    dateRangeChange: [preset: string];
    includeBotsChange: [includeBots: boolean];
}>();

const activeTab = ref( 'overview' );

const presetOptions = computed( () => {
    return Object.entries( props.dateRangePresets ).map( ( [ id, name ] ) => ( {
        id,
        name,
    } ) );
} );

function handlePresetChange( event: Event ): void {
    emit( 'dateRangeChange', ( event.target as HTMLSelectElement ).value );
}

function handleIncludeBotsChange( event: Event ): void {
    emit( 'includeBotsChange', ( event.target as HTMLInputElement ).checked );
}

const tabs: TabItem[] = [
    { name: 'overview', label: 'Overview' },
    { name: 'pages', label: 'Pages' },
    { name: 'traffic', label: 'Traffic' },
    { name: 'audience', label: 'Audience' },
];
</script>

<template>
    <div class="space-y-6">
        <!-- Header with date range selector -->
        <Card>
            <div class="flex items-center justify-between">
                <h2 class="text-2xl font-bold">Analytics Dashboard</h2>
                <div class="flex items-center gap-4">
                    <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input
                            type="checkbox"
                            class="toggle toggle-sm"
                            :checked="props.includeBots"
                            aria-label="Include bot traffic"
                            @change="handleIncludeBotsChange"
                        />
                        <span>Include bot traffic</span>
                    </label>
                    <div class="w-48">
                        <Select
                            :options="presetOptions"
                            :model-value="props.dateRangePreset"
                            @change="handlePresetChange"
                        />
                    </div>
                </div>
            </div>
        </Card>

        <!-- Tabbed content -->
        <Tabs
            :tabs="tabs"
            v-model:active-tab="activeTab"
            variant="bordered"
        >
            <template #overview>
                <div class="space-y-6 pt-4">
                    <StatsCards :stats="props.stats" />
                    <VisitorsChart :chart-data="props.chartData" />
                    <Grid :cols="1" :cols-lg="2" :gap="6">
                        <TopPages :top-pages="props.topPages" :limit="5" />
                        <TrafficSources :traffic-sources="props.trafficSources" :limit="5" />
                    </Grid>
                </div>
            </template>

            <template #pages>
                <div class="space-y-6 pt-4">
                    <VisitorsChart :chart-data="props.chartData" />
                    <TopPages :top-pages="props.topPages" />
                </div>
            </template>

            <template #traffic>
                <div class="space-y-6 pt-4">
                    <TrafficSources :traffic-sources="props.trafficSources" />
                </div>
            </template>

            <template #audience>
                <div class="space-y-6 pt-4">
                    <StatsCards :stats="props.stats" />
                </div>
            </template>
        </Tabs>
    </div>
</template>
