<!--
  VisitorsChart Vue component.

  Renders a time-series area chart of page views and visitors using
  @artisanpack-ui/vue Chart (ApexCharts). Includes granularity
  selector buttons. Mirrors the Livewire VisitorsChart widget.

  @since 1.1.0
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { Card, Chart, Button } from '@artisanpack-ui/vue';

import type { ChartSeries } from '@artisanpack-ui/vue';

export interface ChartDataPoint {
    date: string;
    pageviews: number;
    visitors: number;
}

export type Granularity = 'hour' | 'day' | 'week' | 'month';

const props = withDefaults( defineProps<{
    /** Time-series data points from the API. */
    chartData: ChartDataPoint[];
    /** Available granularity options. */
    granularityOptions?: Granularity[];
    /** The initial granularity. */
    defaultGranularity?: Granularity;
}>(), {
    granularityOptions: () => [ 'day', 'week', 'month' ],
    defaultGranularity: 'day',
} );

const emit = defineEmits<{
    granularityChange: [granularity: Granularity];
}>();

const granularity = ref<Granularity>( props.defaultGranularity );

const granularityLabels: Record<Granularity, string> = {
    hour: 'Hourly',
    day: 'Daily',
    week: 'Weekly',
    month: 'Monthly',
};

function handleGranularityChange( newGranularity: Granularity ): void {
    granularity.value = newGranularity;
    emit( 'granularityChange', newGranularity );
}

const chartSeries = computed<ChartSeries[]>( () => [
    {
        name: 'Pageviews',
        data: props.chartData.map( ( d ) => d.pageviews ),
    },
    {
        name: 'Visitors',
        data: props.chartData.map( ( d ) => d.visitors ),
    },
] );

const categories = computed( () => props.chartData.map( ( d ) => d.date ) );
</script>

<template>
    <Card title="Visitors &amp; Pageviews">
        <template #menu>
            <div class="flex gap-1">
                <Button
                    v-for="option in props.granularityOptions"
                    :key="option"
                    :label="granularityLabels[option]"
                    size="xs"
                    :color="granularity === option ? 'primary' : 'ghost'"
                    @click="handleGranularityChange( option )"
                />
            </div>
        </template>

        <p
            v-if="props.chartData.length === 0"
            class="text-base-content/50 text-center py-8"
        >
            No data available for this period.
        </p>
        <Chart
            v-else
            type="area"
            :series="chartSeries"
            :labels="categories"
            :height="300"
        />
    </Card>
</template>
