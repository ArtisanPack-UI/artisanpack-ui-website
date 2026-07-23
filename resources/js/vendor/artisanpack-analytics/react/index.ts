/**
 * ArtisanPack Analytics — React dashboard components.
 *
 * Barrel file re-exporting all React dashboard components so consumers
 * can import from a single entry point:
 *
 *   import { AnalyticsDashboard, StatsCards } from '@artisanpack-ui/analytics/react';
 *
 * @since 1.1.0
 */

// Components (widgets)
export { default as StatsCards } from './components/StatsCards';
export { default as VisitorsChart } from './components/VisitorsChart';
export { default as TopPages } from './components/TopPages';
export { default as TrafficSources } from './components/TrafficSources';
export { default as RealtimeVisitors } from './components/RealtimeVisitors';
export { default as BotTraffic } from './components/BotTraffic';

// Components (consent)
export { default as ConsentBanner } from './components/ConsentBanner';
export { default as ConsentPreferences } from './components/ConsentPreferences';
export { default as ConsentStatus } from './components/ConsentStatus';

// Components (selectors)
export { default as SiteSelector } from './components/SiteSelector';

// Page components
export { default as AnalyticsDashboard } from './pages/AnalyticsDashboard';
export { default as PageAnalytics } from './pages/PageAnalytics';
export { default as MultiTenantDashboard } from './pages/MultiTenantDashboard';

// Hooks
export { useAnalyticsApi } from './hooks/useAnalyticsApi';
export { useConsent } from './hooks/useConsent';

// Types (re-exported for convenience — includes enums as values)
export * from './types';
