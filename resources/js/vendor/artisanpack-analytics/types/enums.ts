/**
 * TypeScript enum types for ArtisanPack Analytics.
 *
 * These mirror the PHP enums and class constants defined in
 * `src/Enums/` and `src/Models/`.
 */

// --- EventType (src/Enums/EventType.php) ---

/** Core tracking event types. */
export enum EventType {
    // Core Events
    PAGE_VIEW = 'page_view',
    SESSION_START = 'session_start',
    SESSION_END = 'session_end',
    CLICK = 'click',
    SCROLL = 'scroll',
    SEARCH = 'search',
    DOWNLOAD = 'download',
    OUTBOUND_LINK = 'outbound_link',
    VIDEO_PLAY = 'video_play',
    VIDEO_COMPLETE = 'video_complete',

    // Form Events
    FORM_VIEW = 'form_view',
    FORM_START = 'form_start',
    FORM_SUBMIT = 'form_submitted',
    FORM_ERROR = 'form_error',

    // Ecommerce Events
    PRODUCT_VIEW = 'product_view',
    ADD_TO_CART = 'add_to_cart',
    REMOVE_FROM_CART = 'remove_from_cart',
    BEGIN_CHECKOUT = 'begin_checkout',
    ADD_PAYMENT_INFO = 'add_payment_info',
    PURCHASE = 'purchase',
    REFUND = 'refund',

    // Booking Events
    SERVICE_VIEW = 'service_view',
    BOOKING_START = 'booking_start',
    TIME_SELECTED = 'time_selected',
    BOOKING_CREATED = 'booking_created',
    BOOKING_CANCELLED = 'booking_cancelled',
}

/** Event category strings returned by EventType::getCategory(). */
export type EventCategory =
    | 'forms'
    | 'ecommerce'
    | 'booking'
    | 'engagement'
    | null;

// --- Consent categories (src/Models/Consent.php) ---

export enum ConsentCategory {
    ANALYTICS = 'analytics',
    MARKETING = 'marketing',
    FUNCTIONAL = 'functional',
    PREFERENCES = 'preferences',
}

// --- Goal types (src/Models/Goal.php) ---

export enum GoalType {
    EVENT = 'event',
    PAGEVIEW = 'pageview',
    DURATION = 'duration',
    PAGES_PER_SESSION = 'pages_per_session',
}

export enum GoalValueType {
    NONE = 'none',
    FIXED = 'fixed',
    DYNAMIC = 'dynamic',
}

// --- Aggregate periods and metrics (src/Models/Aggregate.php) ---

export enum AggregatePeriod {
    HOUR = 'hour',
    DAY = 'day',
    WEEK = 'week',
    MONTH = 'month',
}

export enum AggregateMetric {
    PAGEVIEWS = 'pageviews',
    VISITORS = 'visitors',
    SESSIONS = 'sessions',
    BOUNCE_RATE = 'bounce_rate',
    AVG_DURATION = 'avg_duration',
    AVG_PAGES = 'avg_pages',
    EVENTS = 'events',
    CONVERSIONS = 'conversions',
    CONVERSION_VALUE = 'conversion_value',
}

export enum AggregateDimension {
    PATH = 'path',
    COUNTRY = 'country',
    DEVICE_TYPE = 'device_type',
    BROWSER = 'browser',
    REFERRER_TYPE = 'referrer_type',
    UTM_SOURCE = 'utm_source',
    EVENT_NAME = 'event_name',
    EVENT_CATEGORY = 'event_category',
    GOAL_ID = 'goal_id',
}

// --- Session referrer types (used in Session model) ---

export type ReferrerType =
    | 'direct'
    | 'organic'
    | 'social'
    | 'referral'
    | 'email'
    | 'paid';

// --- Device type (used across models and DTOs) ---

export type DeviceType = 'desktop' | 'mobile' | 'tablet';

// --- Date range presets (used in API query parameters) ---

export type DateRangePreset =
    | '7d'
    | '30d'
    | '90d'
    | 'today'
    | 'yesterday'
    | 'this_week'
    | 'last_week'
    | 'this_month'
    | 'last_month'
    | 'this_year';
