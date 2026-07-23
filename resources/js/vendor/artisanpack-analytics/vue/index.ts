/**
 * ArtisanPack Analytics — Vue dashboard components.
 *
 * Barrel file re-exporting all Vue dashboard components so consumers
 * can import from a single entry point:
 *
 *   import { AnalyticsDashboard, StatsCards } from '@artisanpack-ui/analytics/vue';
 *
 * @since 1.1.0
 */

// Components (widgets)
export { default as StatsCards } from './components/StatsCards.vue';
export { default as VisitorsChart } from './components/VisitorsChart.vue';
export { default as TopPages } from './components/TopPages.vue';
export { default as TrafficSources } from './components/TrafficSources.vue';
export { default as RealtimeVisitors } from './components/RealtimeVisitors.vue';
export { default as BotTraffic } from './components/BotTraffic.vue';

// Components (consent)
export { default as ConsentBanner } from './components/ConsentBanner.vue';
export { default as ConsentPreferences } from './components/ConsentPreferences.vue';
export { default as ConsentStatus } from './components/ConsentStatus.vue';

// Components (selectors)
export { default as SiteSelector } from './components/SiteSelector.vue';

// Page components
export { default as AnalyticsDashboard } from './pages/AnalyticsDashboard.vue';
export { default as PageAnalytics } from './pages/PageAnalytics.vue';
export { default as MultiTenantDashboard } from './pages/MultiTenantDashboard.vue';

// Composables
export { useAnalyticsApi } from './composables/useAnalyticsApi';
export { useConsent } from './composables/useConsent';

// Types (re-exported for convenience — includes enums as values)
export * from './types';
