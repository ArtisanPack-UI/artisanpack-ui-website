<!--
  PageAnalytics Vue component.

  Displays analytics for a specific page including pageviews, visitors,
  bounce rate, and a sparkline chart using @artisanpack-ui/vue
  Card, Stat, Badge, and Sparkline. Mirrors the Livewire PageAnalytics
  component.

  @since 1.1.0
-->
<script setup lang="ts">
import { computed } from 'vue';
import { Card, Stat, Badge, Sparkline } from '@artisanpack-ui/vue';

import type { PageAnalyticsData, PageViewOverTimeItem } from '../../types';

const props = withDefaults( defineProps<{
    /** The page path being analyzed. */
    path: string;
    /** Analytics data for the page. */
    analytics: PageAnalyticsData;
    /** Time-series data for the sparkline chart. */
    viewsOverTime?: PageViewOverTimeItem[];
    /** Whether to show the inline chart. Defaults to true. */
    showChart?: boolean;
    /** Whether to use compact layout. Defaults to false. */
    compact?: boolean;
}>(), {
    viewsOverTime: () => [],
    showChart: true,
    compact: false,
} );

const chartData = computed( () =>
    props.viewsOverTime.length > 0
        ? props.viewsOverTime
        : props.analytics.over_time ?? [],
);

const sparklineData = computed( () =>
    chartData.value.map( ( d ) => d.pageviews ),
);

const bounceRateDisplay = computed( () =>
    props.analytics.bounce_rate != null
        ? `${props.analytics.bounce_rate.toFixed( 1 )}%`
        : '\u2014',
);
</script>

<template>
    <Card v-if="compact" compact>
        <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <Badge :value="props.path" ghost size="sm" />
                <span class="text-sm">
                    {{ new Intl.NumberFormat().format( props.analytics.pageviews ) }} views
                </span>
                <span class="text-sm text-base-content/50">
                    {{ new Intl.NumberFormat().format( props.analytics.visitors ) }} visitors
                </span>
            </div>
            <Sparkline
                v-if="showChart && sparklineData.length >= 2"
                :data="sparklineData"
                type="area"
                :height="30"
                :width="120"
                color="primary"
            />
        </div>
    </Card>

    <Card v-else :title="props.path">
        <div class="stats stats-vertical lg:stats-horizontal shadow w-full">
            <Stat
                title="Pageviews"
                :value="new Intl.NumberFormat().format( props.analytics.pageviews )"
            />
            <Stat
                title="Visitors"
                :value="new Intl.NumberFormat().format( props.analytics.visitors )"
            />
            <Stat
                title="Bounce Rate"
                :value="bounceRateDisplay"
            />
        </div>
        <div v-if="showChart && sparklineData.length >= 2" class="mt-4">
            <Sparkline
                :data="sparklineData"
                type="area"
                :height="60"
                color="primary"
            />
        </div>
    </Card>
</template>
