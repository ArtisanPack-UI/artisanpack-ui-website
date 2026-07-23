<!--
  MultiTenantDashboard Vue component.

  Wraps the AnalyticsDashboard with site selection functionality for
  multi-tenant environments using @artisanpack-ui/vue Card.
  Mirrors the Livewire MultiTenantDashboard component.

  @since 1.1.0
-->
<script setup lang="ts">
import { ref, watch } from 'vue';
import { Card } from '@artisanpack-ui/vue';

import type { Site, TopPageItem, TrafficSourceItem, StatsComparison } from '../../types';
import type { ChartDataPoint } from '../components/VisitorsChart.vue';

import AnalyticsDashboard from './AnalyticsDashboard.vue';
import SiteSelector from '../components/SiteSelector.vue';

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
    /** Array of available sites for selection. */
    sites: Site[];
    /** The initially selected site ID. */
    initialSiteId?: number | null;
    /** Whether multi-tenant mode is enabled. */
    multiTenantEnabled?: boolean;
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
}>(), {
    initialSiteId: null,
    multiTenantEnabled: true,
    dateRangePreset: '30d',
    dateRangePresets: undefined,
} );

const emit = defineEmits<{
    siteChange: [siteId: number];
    dateRangeChange: [preset: string];
}>();

const selectedSiteId = ref<number | null>( props.initialSiteId );

watch( () => props.initialSiteId, ( newVal ) => {
    selectedSiteId.value = newVal;
} );

function handleSiteChange( siteId: number ): void {
    selectedSiteId.value = siteId;
    emit( 'siteChange', siteId );
}
</script>

<template>
    <div class="space-y-6">
        <Card v-if="multiTenantEnabled && sites.length > 1">
            <SiteSelector
                :sites="props.sites"
                :selected-site-id="selectedSiteId"
                @site-change="handleSiteChange"
            />
        </Card>

        <AnalyticsDashboard
            :stats="props.stats"
            :chart-data="props.chartData"
            :top-pages="props.topPages"
            :traffic-sources="props.trafficSources"
            :date-range-preset="props.dateRangePreset"
            :date-range-presets="props.dateRangePresets"
            @date-range-change="( preset ) => emit( 'dateRangeChange', preset )"
        />
    </div>
</template>
