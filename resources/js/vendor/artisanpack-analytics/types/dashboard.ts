/**
 * TypeScript interfaces for ArtisanPack Analytics dashboard components.
 *
 * These represent the prop shapes exposed by the Livewire dashboard
 * components in `src/Http/Livewire/` and the data structures passed
 * to their Blade views.
 */

import type { DateRangePreset } from './enums';
import type { Site } from './models';
import type {
    BrowserBreakdownItem,
    CountryBreakdownItem,
    DeviceBreakdownItem,
    StatsComparison,
    TopPageItem,
    TrafficSourceItem,
} from './api';

// ---------------------------------------------------------------------------
// Chart data (shared across dashboard widgets)
// ---------------------------------------------------------------------------

export interface ChartDataset {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    fill: boolean;
    tension: number;
}

export interface ChartData {
    labels: string[];
    datasets: ChartDataset[];
}

// ---------------------------------------------------------------------------
// AnalyticsDashboard (src/Http/Livewire/AnalyticsDashboard.php)
// ---------------------------------------------------------------------------

export type DashboardTab = 'overview' | string;

export interface DashboardStats {
    pageviews: number;
    visitors: number;
    sessions: number;
    bounce_rate: number;
    avg_session_duration: number;
    comparison?: StatsComparison;
}

export interface AnalyticsDashboardProps {
    activeTab: DashboardTab;
    stats: DashboardStats;
    chartData: ChartData;
    topPages: TopPageItem[];
    trafficSources: TrafficSourceItem[];
    deviceBreakdown: DeviceBreakdownItem[];
    browserBreakdown: BrowserBreakdownItem[];
    countryBreakdown: CountryBreakdownItem[];
}

// ---------------------------------------------------------------------------
// PlatformDashboard (src/Http/Livewire/PlatformDashboard.php)
// ---------------------------------------------------------------------------

export interface PlatformStats {
    visitors: number;
    sessions: number;
    pageviews: number;
    events: number;
    conversions: number;
    [key: string]: number;
}

export interface TopSiteItem {
    id: number;
    name: string;
    domain: string;
    visitors: number;
    sessions: number;
    pageviews: number;
}

export interface SiteGrowthItem {
    id: number;
    name: string;
    domain: string;
    current_visitors: number;
    previous_visitors: number;
    growth_percentage: number;
}

export interface PlatformDashboardProps {
    dateRange: DateRangePreset;
    topSitesLimit: number;
    platformStats: PlatformStats;
    topSites: TopSiteItem[];
    sitesWithGrowth: SiteGrowthItem[];
}

// ---------------------------------------------------------------------------
// MultiTenantDashboard (src/Http/Livewire/MultiTenantDashboard.php)
// ---------------------------------------------------------------------------

export interface MultiTenantDashboardProps {
    siteId: number | null;
    dateRangePreset: DateRangePreset;
    multiTenantEnabled: boolean;
    currentSite: Site | null;
    showSiteSelector: boolean;
}

// ---------------------------------------------------------------------------
// PageAnalytics (src/Http/Livewire/PageAnalytics.php)
// ---------------------------------------------------------------------------

export interface PageViewOverTimeItem {
    date: string;
    pageviews: number;
    visitors: number;
}

export interface PageAnalyticsData {
    pageviews: number;
    visitors: number;
    bounce_rate: number;
    over_time: PageViewOverTimeItem[];
}

export interface PageAnalyticsProps {
    path: string;
    analytics: PageAnalyticsData;
    viewsOverTime: PageViewOverTimeItem[];
    showChart: boolean;
    compact: boolean;
}
