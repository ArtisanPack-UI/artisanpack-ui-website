export interface Kpi {
    label: string;
    value: number;
    format: 'currency' | 'number';
    delta: number;
    delta_label: string;
}

export interface RevenueSeries {
    categories: string[];
    series: Array<{ name: string; data: number[] }>;
}

export interface TrafficSource {
    source: string;
    visitors: number;
    percent: number;
}

export interface TopPage {
    path: string;
    title: string;
    views: number;
    unique_views: number;
}

export interface OrderRow {
    id: string;
    customer: string;
    total: number;
    status: 'paid' | 'fulfilled' | 'pending' | 'refunded';
    placed_at: string;
    items: number;
}

export interface LeadRow {
    id: number;
    name: string;
    email: string;
    form: string;
    company?: string;
    received_at: string;
    status: 'new' | 'contacted' | 'qualified';
}

export interface PageRow {
    id: number;
    title: string;
    slug: string;
    status: 'published' | 'draft' | 'scheduled';
    updated_at: string;
    author: string;
    views: number;
}

export interface PostRow {
    id: number;
    title: string;
    slug: string;
    permalink: string;
    status: 'published' | 'draft' | 'scheduled';
    category: string;
    published_at: string | null;
    author: string;
    comments: number;
}

// MediaRow lives in the artisanpack-ui/media-library types — re-exported
// for any Keystone code that wants to pass picked media around.
export type { Media as MediaRow } from '@/vendor/media-library/types/media';

export interface ProductRow {
    id: number;
    name: string;
    sku: string;
    price: number;
    inventory: number | null;
    status: 'active' | 'low_stock' | 'out_of_stock' | 'draft';
    updated_at: string;
}

export interface CustomerRow {
    id: number;
    name: string;
    email: string;
    orders: number;
    lifetime: number;
    last_seen: string;
}

export interface FormRow {
    id: number;
    name: string;
    slug?: string;
    submissions: number;
    unread?: number;
    conversion: number;
    last_submission: string | null;
    status: 'active' | 'paused' | 'draft';
}

export interface UserRow {
    id: number;
    name: string;
    email: string;
    role: string;
    last_active: string;
    status: 'active' | 'invited';
}

export interface IntegrationRow {
    id: number;
    name: string;
    category: string;
    status: 'connected' | 'available' | 'error';
    connected_by: string | null;
    connected_at: string | null;
}

export interface ActivityEvent {
    id: number;
    actor: string;
    action: string;
    target: string;
    at: string;
}

export interface NotificationItem {
    id: number;
    title: string;
    message: string;
    /**
     * Free-form category string. Real notifications surface the vendor
     * `NotificationType` value (`error`/`warning`/`success`/`info`) or, when
     * the dispatcher set `metadata.kind`, a domain category such as `order`,
     * `lead`, `inventory`, `system`, `content`, or `reports`. The Notifications
     * UI looks the kind up in label/tone dictionaries and falls back to the
     * raw string + neutral tone when it doesn't recognize it.
     */
    kind: string;
    created_at: string;
    read: boolean;
}

export interface SiteInfo {
    name: string;
    url: string;
    environment: string;
    last_published: string;
}

export interface FunnelStep {
    label: string;
    value: number;
}

export interface KeystoneFeatures {
    blog: boolean;
    forms: boolean;
    analytics: boolean;
    ecommerce: boolean;
    booking: boolean;
}

/**
 * General localization settings shared on every page so the client date
 * formatter renders dates in the configured format, timezone, and locale.
 */
export interface KeystoneFormats {
    date: string;
    time: string;
    timezone: string;
    locale: string;
}

/**
 * "Create once, use everywhere" business info shared on every page so
 * any React component can render hours, contact details, or social
 * links without a per-page round-trip. Backed by the `global.*` settings
 * edited in Site Design > Business Info.
 */
export interface KeystoneGlobalContent {
    business_name: string;
    phone: string;
    email: string;
    address: {
        street: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
    };
    hours: Record<
        'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
        { open: string; close: string; closed: boolean }
    >;
    social_links: Array<{ platform: string; url: string }>;
}

/**
 * A single terminal entry in the admin sidebar. Rendered as an Inertia
 * `Link` (or a plain `<a>` when `external` is set) and, when it declares
 * `children`, expanded into a sub-list.
 *
 * `iconId` is a string key looked up in the client-side `Icon` map; the
 * server never ships a React element. `matchPrefix` (child rows only)
 * lets one entry highlight for a cluster of sibling routes.
 */
export interface AdminMenuChild {
    key: string;
    label: string;
    url: string;
    matchPrefix?: string | string[];
}

export interface AdminMenuItem {
    key: string;
    label: string;
    iconId: string;
    url: string;
    external: boolean;
    badge?: number;
    children?: AdminMenuChild[];
}

export interface AdminMenuGroup {
    key: string;
    label: string;
    items: AdminMenuItem[];
}

export type AdminMenu = AdminMenuGroup[];

export interface KeystoneSharedProps {
    auth: {
        user: {
            id: number;
            display_name: string;
            email: string;
            email_verified_at: string | null;
        } | null;
        roles: string[];
        permissions: string[];
    };
    keystone: {
        me: {
            name: string;
            email: string;
            handle: string;
            role: string;
            initials: string;
            photo_url: string | null;
        };
        site: SiteInfo;
        brand: SiteBrand;
        /**
         * Currently-installed Keystone version (`config('app.version')`).
         * Rendered in the sidebar footer so the admin surface reflects the
         * real build rather than a hardcoded label.
         */
        version: string;
        adminTheme: KeystoneAdminTheme;
        notifications: NotificationItem[];
        features: KeystoneFeatures;
        adminMenu: AdminMenu;
        updateAvailable: KeystoneUpdateAvailable | null;
        formats: KeystoneFormats;
        globalContent: KeystoneGlobalContent;
        privacy: { api_prefix: string };
        performance: { api_prefix: string };
        /**
         * Federated plugin pages available to this viewer, plus optional
         * side-effect boot modules the shell preloads before the first
         * page mounts so plugin-registered actions/filters bind in time
         * for the admin chrome. `pages` is keyed by the Inertia page name
         * the controller renders (e.g. `plugins/hello-world/dashboard`).
         * Both are empty when the viewer is not an admin or when no active
         * plugin exposes a federated module. See
         * `resources/js/lib/plugins/federated-loader.ts` for the runtime.
         */
        federatedModules: {
            pages: Record<
                string,
                { remote: string; entry: string; module: string }
            >;
            bootModules: Array<{ remote: string; entry: string; module: string }>;
        };
    };
}

/**
 * The "update available" payload shared with admins. Surfaced as a
 * banner on the dashboard and populated by the daily
 * `update:check-scheduled` cms-framework command. `null` whenever no
 * update is pending, the viewer is not an admin, or the check failed.
 */
export interface KeystoneUpdateAvailable {
    latest_version: string;
    current_version: string;
    release_url: string | null;
    release_date: string | null;
}

/**
 * Admin brand palette + forced color scheme applied to the admin chrome only.
 * Colors are validated hex strings or null (null keeps the built-in daisyUI
 * theme default). `forceTheme` pins the admin scheme; `system` respects the
 * per-user/browser preference.
 *
 * Each brand colour ships as two variants: the base key (`primaryColor`,
 * `secondaryColor`, `accentColor`) is clamped for the LIGHT theme's base
 * surface, and the matching `*Dark` key is clamped for the DARK theme's base
 * surface. `AdminTheme::palette()` and the mirror in `useAdminPalette` apply
 * the same WCAG contrast floor so a user-picked colour that reads fine in
 * one scheme but not the other still stays readable in both.
 */
export interface KeystoneAdminTheme {
    primaryColor: string | null;
    primaryColorDark: string | null;
    secondaryColor: string | null;
    secondaryColorDark: string | null;
    accentColor: string | null;
    accentColorDark: string | null;
    forceTheme: 'system' | 'light' | 'dark';
}

/** Live site branding used by the admin chrome (sidebar brand mark). */
export interface SiteBrand {
    name: string;
    url: string;
    logoUrl: string | null;
}

/** Slim media record used to preview the brand logo. */
export interface BrandLogo {
    id: number;
    url: string;
}

/** Grouped, real settings values backing the admin Settings page. */
export interface AdminSettings {
    general: {
        siteName: string;
        siteUrl: string;
        description: string;
        timezone: string;
        locale: string;
        weekStart: string;
        dateFormat: string;
        timeFormat: string;
        visibility: string;
        hasSitePassword: boolean;
    };
    brand: {
        primaryColor: string;
        secondaryColor: string;
        accentColor: string;
        forceTheme: string;
        logo: BrandLogo | null;
    };
    seo: {
        defaultMetaTitle: string;
        defaultMetaDescription: string;
        noIndex: boolean;
        titleSeparator: string;
        ogDefaultImageId: number;
        twitterHandle: string;
        schemaOrganization: boolean;
        schemaWebsite: boolean;
    };
    discussion: {
        comments: boolean;
        commentsApproval: string;
        bannedWords: string;
        requireRegistration: boolean;
        limitLinks: number;
        captcha: boolean;
    };
    permalinks: {
        structure: string;
    };
    security: {
        loginAttempts: number;
        loginTimeout: number;
        forceTwoFactor: boolean;
    };
    notifications: {
        newOrders: boolean;
        lowStock: boolean;
        newLeads: boolean;
        dailyDigest: boolean;
        weeklyReport: boolean;
    };
    developers: {
        apiEnabled: boolean;
        webhookUrl: string;
    };
    privacy: {
        settings: {
            gdpr_enabled: boolean;
            ccpa_enabled: boolean;
            lgpd_enabled: boolean;
            pipeda_enabled: boolean;
            admin_email: string;
            dpo_name: string;
            dpo_email: string;
            dpo_phone: string;
            authority_email: string;
            retention_days: number | null;
        };
        categories: Array<{
            id: number;
            key: string;
            name: string;
            description: string | null;
            required: boolean;
            active: boolean;
            sort_order: number;
            regulations: string[];
        }>;
        stats: {
            consent_rows: number;
            pending_dsr_requests: number;
            total_dsr_requests: number;
        };
    };
    performance: {
        settings: {
            image_optimization: boolean;
            page_cache: boolean;
            fragment_cache: boolean;
            monitoring: boolean;
            speculative_loading: boolean;
            resource_hints: boolean;
            early_hints: boolean;
            html_minification: boolean;
            query_optimization: boolean;
            image_driver: string;
        };
        defaults: {
            sampling_rate: number;
            page_cache_ttl: number;
            fragment_cache_ttl: number;
        };
        drivers: Array<{ value: string; label: string }>;
    };
}

/**
 * Per-instance options blob for a dashboard widget. Stored verbatim in the
 * dashboard's `widgets` JSON and forwarded to the widget's React component.
 * Each widget defines its own option shape via its `settings_schema`.
 */
export type WidgetOptions = Record<string, unknown>;

/**
 * Grid placement for a single widget at a given breakpoint. `cols` is a 1–12
 * column span; `rows` is currently informational (the grid uses CSS row
 * auto-placement) but is preserved so future row-spanning widgets can opt in.
 */
export interface WidgetGridConfig {
    rows: number;
    cols: number;
}

/**
 * A widget instance hydrated by `DashboardController`. Mirrors the array
 * produced by `AdminWidgetManager::createWidget()` plus the server-side
 * `data` payload from `getData()`.
 */
export interface Widget {
    id: string;
    type: string;
    title: string;
    capability: string | null;
    order: number;
    color_scheme: string;
    grid_config: {
        sm: WidgetGridConfig;
        md: WidgetGridConfig;
        lg: WidgetGridConfig;
        xl: WidgetGridConfig;
    };
    options: WidgetOptions;
    created_at: string;
    updated_at: string;
    data?: unknown;
    /** Set by the controller when a widget's `getData()` threw. */
    error?: boolean;
}

/**
 * Summary row in the dashboard switcher. The currently-rendered dashboard
 * comes through as `DashboardWithWidgets` and includes the hydrated widget
 * instances.
 */
export interface DashboardSummary {
    id: number;
    name: string;
    slug: string;
    is_default: boolean;
    position: number;
}

export interface DashboardWithWidgets extends DashboardSummary {
    widgets: Widget[];
}

/**
 * Catalog entry the Add Widget drawer renders. Shape merges the framework's
 * `getWidgetInfo()` with the Keystone-specific `extendedInfo()`. `component`
 * is the React-side key resolved via the widget registry.
 */
export interface AvailableWidget {
    title: string;
    description?: string;
    default_options?: WidgetOptions;
    capability?: string | null;
    component: string;
    settings_schema?: Record<string, unknown>;
    /**
     * Per-breakpoint grid spans a fresh instance of this widget would receive.
     * Sourced from `extendedInfo().default_grid_config` so the Layout editor
     * can offer a "Reset to default" control without round-tripping the
     * server, and so the popover can validate ranges against the same
     * breakpoint set the server enforces.
     */
    default_grid_config?: Record<string, { rows: number; cols: number }>;
    /**
     * Grouping key used by the Add Widget drawer. The controller defaults to
     * `'keystone'` when a widget doesn't declare one, so consumers can rely
     * on it always being present.
     */
    source: string;
    /**
     * Set by widget classes whose `getData()` is still backed by
     * `KeystoneSampleData` rather than real models. The dashboard chrome
     * renders a "Demo data" pill in the widget header while this is true,
     * and the flag goes away when the parent feature ships and the widget
     * switches to live data.
     */
    is_demo?: boolean;
}

export type AvailableWidgets = Record<string, AvailableWidget>;

/**
 * Pre-built dashboard starter offered when the user lands on an empty
 * dashboard. The actual picker UI ships in a sibling sub-issue; the type
 * lives here so the page props can carry the payload from day one.
 */
export interface DashboardStarter {
    slug: string;
    name: string;
    description?: string;
    widgets: Array<Pick<Widget, 'type' | 'grid_config' | 'options'>>;
}

/** Server-supplied option lists for the General panel selects. */
export interface AdminSettingsOptions {
    timezones: string[];
    locales: Array<{ value: string; label: string }>;
    weekDays: Array<{ value: string; label: string }>;
    dateFormats: Array<{ key: string; label: string }>;
    timeFormats: Array<{ key: string; label: string }>;
}
