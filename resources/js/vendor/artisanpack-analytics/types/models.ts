/**
 * TypeScript interfaces for ArtisanPack Analytics Eloquent models.
 *
 * These mirror the shapes returned when models are serialized to JSON
 * via `toArray()` / API responses. Source: `src/Models/`.
 */

import type {
    AggregateDimension,
    AggregateMetric,
    AggregatePeriod,
    ConsentCategory,
    DeviceType,
    GoalType,
    GoalValueType,
    ReferrerType,
} from './enums';

// --- Visitor (src/Models/Visitor.php) ---

export interface Visitor {
    id: string;
    site_id: number;
    fingerprint: string | null;
    user_id: number | null;
    first_seen_at: string;
    last_seen_at: string;
    ip_address: string | null;
    user_agent: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    device_type: DeviceType | null;
    browser: string | null;
    browser_version: string | null;
    os: string | null;
    os_version: string | null;
    screen_width: number | null;
    screen_height: number | null;
    viewport_width: number | null;
    viewport_height: number | null;
    language: string | null;
    timezone: string | null;
    total_sessions: number;
    total_pageviews: number;
    total_events: number;
    tenant_id: string | number | null;
    created_at: string;
    updated_at: string;
}

// --- Session (src/Models/Session.php) ---

export interface Session {
    id: string;
    site_id: number;
    visitor_id: string;
    session_id: string;
    started_at: string;
    ended_at: string | null;
    last_activity_at: string | null;
    duration: number | null;
    entry_page: string | null;
    exit_page: string | null;
    page_count: number;
    is_bounce: boolean;
    referrer: string | null;
    referrer_domain: string | null;
    referrer_type: ReferrerType | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_term: string | null;
    utm_content: string | null;
    landing_page_title: string | null;
    tenant_id: string | number | null;
    created_at: string;
    updated_at: string;
}

// --- PageView (src/Models/PageView.php) ---

export interface PageView {
    id: number;
    site_id: number;
    session_id: string;
    visitor_id: string;
    path: string;
    title: string | null;
    hash: string | null;
    query_string: string | null;
    referrer_path: string | null;
    time_on_page: number | null;
    engaged_time: number | null;
    load_time: number | null;
    dom_ready_time: number | null;
    first_contentful_paint: number | null;
    scroll_depth: number | null;
    custom_data: Record<string, unknown> | null;
    tenant_id: string | number | null;
    created_at: string;
}

// --- Event (src/Models/Event.php) ---

export interface AnalyticsEvent {
    id: number;
    site_id: number;
    session_id: string;
    visitor_id: string;
    page_view_id: number | null;
    name: string;
    category: string | null;
    action: string | null;
    label: string | null;
    properties: Record<string, unknown> | null;
    value: number | null;
    source_package: string | null;
    path: string | null;
    tenant_id: string | number | null;
    created_at: string;
}

// --- Goal (src/Models/Goal.php) ---

export interface GoalCondition {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'regex';
    value: string | number;
}

export interface GoalFunnelStep {
    name: string;
    conditions: GoalCondition[];
}

export interface Goal {
    id: number;
    site_id: number;
    name: string;
    description: string | null;
    type: GoalType;
    conditions: GoalCondition[];
    value_type: GoalValueType;
    fixed_value: number | null;
    dynamic_value_path: string | null;
    is_active: boolean;
    funnel_steps: GoalFunnelStep[] | null;
    tenant_id: string | number | null;
    created_at: string;
    updated_at: string;
}

// --- Conversion (src/Models/Conversion.php) ---

export interface Conversion {
    id: number;
    site_id: number;
    goal_id: number;
    session_id: string;
    visitor_id: string;
    event_id: number | null;
    page_view_id: number | null;
    value: number | null;
    metadata: Record<string, unknown> | null;
    tenant_id: string | number | null;
    created_at: string;
}

// --- Consent (src/Models/Consent.php) ---

export interface Consent {
    id: number;
    site_id: number;
    visitor_id: string;
    category: ConsentCategory;
    granted: boolean;
    ip_address: string | null;
    user_agent: string | null;
    granted_at: string | null;
    revoked_at: string | null;
    expires_at: string | null;
    tenant_id: string | number | null;
    created_at: string;
    updated_at: string;
}

// --- Site (src/Models/Site.php) ---

export interface SiteTrackingSettings {
    enabled: boolean;
    respect_dnt: boolean;
    anonymize_ip: boolean;
    [key: string]: unknown;
}

export interface SiteDashboardSettings {
    default_date_range: string;
    realtime_enabled: boolean;
    [key: string]: unknown;
}

export interface SitePrivacySettings {
    consent_required: boolean;
    [key: string]: unknown;
}

export interface SiteFeatureSettings {
    events: boolean;
    goals: boolean;
    [key: string]: unknown;
}

export interface SiteSettings {
    tracking: SiteTrackingSettings;
    dashboard: SiteDashboardSettings;
    privacy: SitePrivacySettings;
    features: SiteFeatureSettings;
    [key: string]: unknown;
}

export interface Site {
    id: number;
    uuid: string;
    tenant_type: string | null;
    tenant_id: string | number | null;
    name: string;
    domain: string;
    timezone: string;
    currency: string;
    is_active: boolean;
    tracking_enabled: boolean;
    public_dashboard: boolean;
    settings: SiteSettings;
    api_key_last_used_at: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

// --- Aggregate (src/Models/Aggregate.php) ---

export interface Aggregate {
    id: number;
    site_id: number;
    date: string;
    period: AggregatePeriod;
    hour: number | null;
    metric: AggregateMetric;
    dimension: AggregateDimension | null;
    dimension_value: string | null;
    value: number;
    value_sum: number | null;
    value_avg: number | null;
    value_min: number | null;
    value_max: number | null;
    tenant_id: string | number | null;
    created_at: string;
    updated_at: string;
}
