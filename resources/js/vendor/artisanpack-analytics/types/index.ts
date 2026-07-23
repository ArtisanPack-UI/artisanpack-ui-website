/**
 * ArtisanPack Analytics — TypeScript type definitions.
 *
 * This barrel file re-exports every public type so consumers can import
 * from a single entry point:
 *
 *   import type { StatsResponse, EventType, Visitor } from '@artisanpack-ui/analytics/types';
 */

// Enums and literal types
export {
    AggregateDimension,
    AggregateMetric,
    AggregatePeriod,
    ConsentCategory,
    EventType,
    GoalType,
    GoalValueType,
} from './enums';
export type {
    DateRangePreset,
    DeviceType,
    EventCategory,
    ReferrerType,
} from './enums';

// Eloquent model interfaces
export type {
    Aggregate,
    AnalyticsEvent,
    Consent,
    Conversion,
    Goal,
    GoalCondition,
    GoalFunnelStep,
    PageView,
    Session,
    Site,
    SiteDashboardSettings,
    SiteFeatureSettings,
    SitePrivacySettings,
    SiteSettings,
    SiteTrackingSettings,
    Visitor,
} from './models';

// Data Transfer Object interfaces
export type {
    DateRange,
    DeviceInfo,
    EventData,
    PageViewData,
    SessionData,
    VisitorData,
} from './data';

// API response interfaces
export type {
    AnalyticsQueryParams,
    BotAgentItem,
    BotFilterMode,
    BotStatsData,
    BotStatsResponse,
    BotTrendPoint,
    BrowserBreakdownItem,
    BrowserBreakdownResponse,
    ApiDataResponse,
    ApiErrorResponse,
    ApiSuccessResponse,
    ComparisonValue,
    ConsentStatusItem,
    ConsentStatusResponse,
    ConsentUpdateRequest,
    ConsentUpdateResponse,
    CountriesResponse,
    CountryBreakdownItem,
    DeviceBreakdownItem,
    DevicesResponse,
    EventBreakdownItem,
    EventsResponse,
    RealtimeData,
    RealtimePageView,
    RealtimeQueryParams,
    RealtimeResponse,
    RotateApiKeyResponse,
    SessionStartResponse,
    SiteData,
    SiteGoalItem,
    SiteGoalsQueryParams,
    SiteGoalsResponse,
    SiteResponse,
    SiteSettingsUpdateData,
    SiteSettingsUpdateResponse,
    SiteStatsData,
    SiteStatsQueryParams,
    SiteStatsResponse,
    StatsComparison,
    StatsData,
    StatsResponse,
    TopPageItem,
    TopPagesResponse,
    TrafficSourceItem,
    TrafficSourcesResponse,
    VisitorStatsData,
    VisitorStatsResponse,
} from './api';

// Dashboard / component prop interfaces
export type {
    AnalyticsDashboardProps,
    ChartData,
    ChartDataset,
    DashboardStats,
    DashboardTab,
    MultiTenantDashboardProps,
    PageAnalyticsData,
    PageAnalyticsProps,
    PageViewOverTimeItem,
    PlatformDashboardProps,
    PlatformStats,
    SiteGrowthItem,
    TopSiteItem,
} from './dashboard';
