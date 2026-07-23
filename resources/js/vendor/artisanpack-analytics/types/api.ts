/**
 * TypeScript interfaces for ArtisanPack Analytics API responses.
 *
 * These match the JSON response shapes returned by the controllers in
 * `src/Http/Controllers/Api/`.
 */

import type { DateRange } from './data';
import type { DateRangePreset, GoalType } from './enums';
import type { SiteSettings } from './models';

// ---------------------------------------------------------------------------
// Generic response wrappers
// ---------------------------------------------------------------------------

/** Standard success envelope used by AnalyticsQueryController. */
export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
    range: DateRange;
}

/** Standard data envelope used by SiteApiController. */
export interface ApiDataResponse<T> {
    data: T;
}

/** Error response shape. */
export interface ApiErrorResponse {
    error: string;
    message: string;
}

// ---------------------------------------------------------------------------
// AnalyticsQueryController — GET /api/analytics/*
// ---------------------------------------------------------------------------

// --- /stats ---

export interface ComparisonValue {
    value: number;
    change: number;
}

export interface StatsComparison {
    pageviews: ComparisonValue;
    visitors: ComparisonValue;
    sessions: ComparisonValue;
    bounce_rate: ComparisonValue;
    avg_session_duration: ComparisonValue;
}

export interface StatsData {
    pageviews: number;
    visitors: number;
    sessions: number;
    bounce_rate: number;
    avg_session_duration: number;
    comparison?: StatsComparison;
}

export type StatsResponse = ApiSuccessResponse<StatsData>;

// --- /pages ---

export interface TopPageItem {
    path: string;
    title: string | null;
    views: number;
    unique_views: number;
    bounce_rate: number;
}

export type TopPagesResponse = ApiSuccessResponse<TopPageItem[]>;

// --- /sources ---

export interface TrafficSourceItem {
    source: string;
    medium: string;
    sessions: number;
    visitors: number;
}

export type TrafficSourcesResponse = ApiSuccessResponse<TrafficSourceItem[]>;

// --- /events ---

export interface EventBreakdownItem {
    name: string;
    category: string | null;
    count: number;
}

export type EventsResponse = ApiSuccessResponse<EventBreakdownItem[]>;

// --- /devices ---

export interface DeviceBreakdownItem {
    device_type: string;
    visitors: number;
    sessions: number;
}

export type DevicesResponse = ApiSuccessResponse<DeviceBreakdownItem[]>;

// --- /browsers (getBrowserBreakdown) ---

export interface BrowserBreakdownItem {
    browser: string;
    version: string;
    sessions: number;
    percentage: number;
}

export type BrowserBreakdownResponse = ApiSuccessResponse<BrowserBreakdownItem[]>;

// --- /countries ---

export interface CountryBreakdownItem {
    country: string;
    country_code: string;
    visitors: number;
    sessions: number;
}

export type CountriesResponse = ApiSuccessResponse<CountryBreakdownItem[]>;

// --- /realtime ---

export interface RealtimePageView {
    path: string;
    timestamp: string;
}

export interface RealtimeData {
    active_visitors: number;
    recent_pageviews: RealtimePageView[];
}

export interface RealtimeResponse {
    success: true;
    data: RealtimeData;
}

// --- /bots ---

export interface BotAgentItem {
    user_agent: string;
    visits: number;
}

export interface BotTrendPoint {
    date: string;
    visits: number;
}

export interface BotStatsData {
    bot_visits: number;
    total_visits: number;
    bot_percentage: number;
    top_agents: BotAgentItem[];
    trend: BotTrendPoint[];
}

export type BotStatsResponse = ApiSuccessResponse<BotStatsData>;

// --- /visitors ---

export interface VisitorStatsData {
    visitors: number;
    pageviews: number;
    sessions: number;
    bounce_rate: number;
    avg_session_duration: number;
}

export type VisitorStatsResponse = ApiSuccessResponse<VisitorStatsData>;

// ---------------------------------------------------------------------------
// SiteApiController — GET /api/analytics/site/*
// ---------------------------------------------------------------------------

// --- /site ---

export interface SiteData {
    id: number;
    uuid: string;
    name: string;
    domain: string;
    timezone: string;
    currency: string;
    is_active: boolean;
    tracking_enabled: boolean;
    public_dashboard: boolean;
    settings: SiteSettings;
    created_at: string;
    updated_at: string;
}

export type SiteResponse = ApiDataResponse<SiteData>;

// --- /site/settings ---

export interface SiteSettingsUpdateData {
    id: number;
    timezone: string;
    currency: string;
    tracking_enabled: boolean;
    public_dashboard: boolean;
    settings: SiteSettings;
}

export interface SiteSettingsUpdateResponse {
    message: string;
    data: SiteSettingsUpdateData;
}

// --- /site/stats ---

export interface SiteStatsData {
    site_id: number;
    site_name: string;
    period: {
        start: string;
        end: string;
        days: number;
    };
    visitors: number;
    sessions: number;
    page_views: number;
    events: number;
    conversions: number;
}

export type SiteStatsResponse = ApiDataResponse<SiteStatsData>;

// --- /site/goals ---

export interface SiteGoalItem {
    id: number;
    name: string;
    description: string | null;
    type: GoalType;
    is_active: boolean;
    created_at: string;
}

export type SiteGoalsResponse = ApiDataResponse<SiteGoalItem[]>;

// --- /site/api-key/rotate ---

export interface RotateApiKeyResponse {
    message: string;
    data: {
        api_key: string;
    };
}

// ---------------------------------------------------------------------------
// AnalyticsController — Tracking endpoints
// ---------------------------------------------------------------------------

/** POST /session/start — the only tracking endpoint that returns a body. */
export interface SessionStartResponse {
    session_id: string;
    site_id: number | null;
}

// ---------------------------------------------------------------------------
// Consent endpoints
// ---------------------------------------------------------------------------

export interface ConsentStatusItem {
    name: string;
    description: string;
    required: boolean;
    granted: boolean;
    granted_at: string | null;
}

export interface ConsentStatusResponse {
    success: boolean;
    consent_required: boolean;
    categories: Record<string, ConsentStatusItem>;
}

export interface ConsentUpdateRequest {
    visitor_id: string;
    categories: Record<string, boolean>;
}

export interface ConsentUpdateResponse {
    success: boolean;
    categories: Record<string, ConsentStatusItem>;
}

// ---------------------------------------------------------------------------
// Query parameter helpers (for building requests)
// ---------------------------------------------------------------------------

/**
 * Bot-traffic filter mode.
 *
 * - `exclude` (default): hide bot traffic.
 * - `include`: show human and bot traffic together.
 * - `only`: show bot traffic only.
 */
export type BotFilterMode = 'exclude' | 'include' | 'only';

export interface AnalyticsQueryParams {
    period?: DateRangePreset;
    start_date?: string;
    end_date?: string;
    site_id?: number;
    path?: string;
    category?: string;
    source_package?: string;
    goal_id?: number;
    limit?: number;
    compare?: boolean;
    bots?: BotFilterMode;
}

export interface RealtimeQueryParams {
    site_id?: number;
    minutes?: number;
}

export interface SiteGoalsQueryParams {
    active_only?: boolean;
}

export interface SiteStatsQueryParams {
    days?: number;
}
