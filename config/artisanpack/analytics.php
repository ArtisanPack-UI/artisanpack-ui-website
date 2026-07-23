<?php

declare( strict_types=1 );

/**
 * ArtisanPack UI - Analytics Configuration
 *
 * This configuration file defines settings for the Analytics package.
 * Settings are merged into the main artisanpack.php config file under the
 * 'analytics' key, following ArtisanPack UI package conventions.
 *
 * After publishing, this file can be found at: config/artisanpack/analytics.php
 *
 *
 * @since      1.0.0
 */
return [
    /*
    |--------------------------------------------------------------------------
    | Analytics Enabled
    |--------------------------------------------------------------------------
    |
    | Master switch to enable or disable all analytics tracking. When disabled,
    | no data will be collected and all tracking endpoints will return early.
    |
    */
    'enabled' => env( 'ANALYTICS_ENABLED', true ),

    /*
    |--------------------------------------------------------------------------
    | Default Provider
    |--------------------------------------------------------------------------
    |
    | The default analytics provider to use. The 'local' provider stores
    | all data in your database for complete privacy and control.
    |
    | Supported: "local", "google", "plausible"
    |
    */
    'default' => env( 'ANALYTICS_PROVIDER', 'local' ),

    /*
    |--------------------------------------------------------------------------
    | Active Providers
    |--------------------------------------------------------------------------
    |
    | Array of providers that should receive analytics data. You can use
    | multiple providers simultaneously for hybrid tracking.
    |
    */
    'active_providers' => array_filter( explode( ',', env( 'ANALYTICS_ACTIVE_PROVIDERS', 'local' ) ) ),

    /*
    |--------------------------------------------------------------------------
    | Route Prefix
    |--------------------------------------------------------------------------
    |
    | The prefix for all analytics API routes. This will be prepended to
    | all analytics endpoints (e.g., /api/analytics/pageview).
    |
    */
    'route_prefix' => env( 'ANALYTICS_ROUTE_PREFIX', 'api/analytics' ),

    /*
    |--------------------------------------------------------------------------
    | Route Middleware
    |--------------------------------------------------------------------------
    |
    | Middleware to apply to analytics API routes. The 'analytics' middleware
    | alias is registered by the package and includes throttling and privacy
    | filtering.
    |
    */
    'route_middleware' => ['api', 'analytics'],

    /*
    |--------------------------------------------------------------------------
    | Dashboard Driver
    |--------------------------------------------------------------------------
    |
    | The driver used to render the analytics dashboard. Set to 'livewire'
    | to use Livewire components (default), or 'inertia' to return Inertia
    | responses with page props for React/Vue dashboards.
    |
    | Supported: "livewire", "inertia"
    |
    */
    'dashboard_driver' => env( 'ANALYTICS_DASHBOARD_DRIVER', 'livewire' ),

    /*
    |--------------------------------------------------------------------------
    | Dashboard Route
    |--------------------------------------------------------------------------
    |
    | The route for the analytics dashboard. Set to null to disable the
    | built-in dashboard route.
    |
    */
    'dashboard_route' => env( 'ANALYTICS_DASHBOARD_ROUTE', 'analytics' ),

    /*
    |--------------------------------------------------------------------------
    | Dashboard Middleware
    |--------------------------------------------------------------------------
    |
    | Middleware to apply to the analytics dashboard route.
    |
    */
    'dashboard_middleware' => ['web', 'auth'],

    /*
    |--------------------------------------------------------------------------
    | Local Provider Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for the local (database) analytics provider. This provider
    | stores all analytics data in your database for complete privacy.
    |
    */
    'local' => [
        'enabled' => env( 'ANALYTICS_LOCAL_ENABLED', true ),

        /*
        |----------------------------------------------------------------------
        | Database Connection
        |----------------------------------------------------------------------
        |
        | The database connection to use for analytics tables. Set to null
        | to use the default connection.
        |
        */
        'connection' => env( 'ANALYTICS_DB_CONNECTION', null ),

        /*
        |----------------------------------------------------------------------
        | Table Prefix
        |----------------------------------------------------------------------
        |
        | Prefix for all analytics database tables.
        |
        */
        'table_prefix' => env( 'ANALYTICS_TABLE_PREFIX', 'analytics_' ),

        /*
        |----------------------------------------------------------------------
        | IP Address Anonymization
        |----------------------------------------------------------------------
        |
        | When enabled, IP addresses will be anonymized by zeroing out
        | the last octet (IPv4) or last 80 bits (IPv6).
        |
        */
        'anonymize_ip' => env( 'ANALYTICS_ANONYMIZE_IP', true ),

        /*
        |----------------------------------------------------------------------
        | Queue Processing
        |----------------------------------------------------------------------
        |
        | When enabled, page views and events are processed asynchronously
        | via queued jobs for better performance.
        |
        */
        'queue_processing' => env( 'ANALYTICS_QUEUE_PROCESSING', true ),

        /*
        |----------------------------------------------------------------------
        | Queue Name
        |----------------------------------------------------------------------
        |
        | The queue name to use for processing analytics jobs.
        |
        */
        'queue_name' => env( 'ANALYTICS_QUEUE_NAME', 'analytics' ),
    ],

    /*
    |--------------------------------------------------------------------------
    | External Providers Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for external analytics providers (Google Analytics, Plausible).
    | These can be used alongside or instead of the local provider.
    |
    */
    'providers' => [
        'google' => [
            'enabled'        => env( 'ANALYTICS_GOOGLE_ENABLED', false ),
            'measurement_id' => env( 'ANALYTICS_GOOGLE_MEASUREMENT_ID' ),
            'api_secret'     => env( 'ANALYTICS_GOOGLE_API_SECRET' ),
        ],

        'plausible' => [
            'enabled' => env( 'ANALYTICS_PLAUSIBLE_ENABLED', false ),
            'domain'  => env( 'ANALYTICS_PLAUSIBLE_DOMAIN' ),
            'api_url' => env( 'ANALYTICS_PLAUSIBLE_API_URL', 'https://plausible.io/api' ),
            'api_key' => env( 'ANALYTICS_PLAUSIBLE_API_KEY' ),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Session Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for session tracking and management.
    |
    */
    'session' => [
        /*
        |----------------------------------------------------------------------
        | Session Timeout
        |----------------------------------------------------------------------
        |
        | Time in minutes after which a session is considered expired
        | due to inactivity.
        |
        */
        'timeout' => env( 'ANALYTICS_SESSION_TIMEOUT', 30 ),

        /*
        |----------------------------------------------------------------------
        | Session Cookie Name
        |----------------------------------------------------------------------
        |
        | Name of the cookie used to store the session identifier.
        |
        */
        'cookie_name' => env( 'ANALYTICS_SESSION_COOKIE', '_ap_sid' ),

        /*
        |----------------------------------------------------------------------
        | Visitor Cookie Name
        |----------------------------------------------------------------------
        |
        | Name of the cookie used to store the visitor identifier.
        |
        */
        'visitor_cookie_name' => env( 'ANALYTICS_VISITOR_COOKIE', '_ap_vid' ),

        /*
        |----------------------------------------------------------------------
        | Cookie Lifetime
        |----------------------------------------------------------------------
        |
        | Lifetime of the visitor cookie in days.
        |
        */
        'cookie_lifetime' => env( 'ANALYTICS_COOKIE_LIFETIME', 365 ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Privacy Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for privacy compliance (GDPR, CCPA, etc.).
    |
    */
    'privacy' => [
        /*
        |----------------------------------------------------------------------
        | Consent Required
        |----------------------------------------------------------------------
        |
        | When enabled, tracking will only occur after user consent is
        | obtained. Integrate with a consent management platform.
        |
        */
        'consent_required' => env( 'ANALYTICS_CONSENT_REQUIRED', false ),

        /*
        |----------------------------------------------------------------------
        | Consent Cookie Lifetime
        |----------------------------------------------------------------------
        |
        | Number of days before consent expires and must be renewed.
        |
        */
        'consent_cookie_lifetime' => env( 'ANALYTICS_CONSENT_LIFETIME', 365 ),

        /*
        |----------------------------------------------------------------------
        | Consent Categories
        |----------------------------------------------------------------------
        |
        | Categories of consent that can be granted or revoked.
        | Each category can be marked as required (always enabled).
        |
        */
        'consent_categories' => [
            'analytics' => [
                'name'        => 'Analytics',
                'description' => 'Helps us understand how visitors use our website.',
                'required'    => false,
            ],
            'marketing' => [
                'name'        => 'Marketing',
                'description' => 'Used to track visitors across websites for advertising.',
                'required'    => false,
            ],
        ],

        /*
        |----------------------------------------------------------------------
        | Respect Do Not Track
        |----------------------------------------------------------------------
        |
        | When enabled, the DNT (Do Not Track) browser header will be
        | respected and no tracking will occur for those visitors.
        |
        */
        'respect_dnt' => env( 'ANALYTICS_RESPECT_DNT', true ),

        /*
        |----------------------------------------------------------------------
        | Anonymization Settings
        |----------------------------------------------------------------------
        |
        | Configure what data should be anonymized for privacy.
        |
        */
        'anonymization' => [
            /*
            | Anonymize IP addresses (zero last octet for IPv4, last 80 bits for IPv6)
            */
            'ip_address' => env( 'ANALYTICS_ANONYMIZE_IP', true ),

            /*
            | Hash user agent strings instead of storing them directly
            */
            'user_agent' => env( 'ANALYTICS_ANONYMIZE_UA', false ),

            /*
            | Round screen resolution to nearest 100 pixels
            */
            'screen_resolution' => env( 'ANALYTICS_ANONYMIZE_SCREEN', false ),
        ],

        /*
        |----------------------------------------------------------------------
        | Excluded IP Addresses
        |----------------------------------------------------------------------
        |
        | IP addresses or CIDR ranges to exclude from tracking.
        | Useful for excluding internal traffic.
        |
        */
        'excluded_ips' => array_filter( explode( ',', env( 'ANALYTICS_EXCLUDED_IPS', '' ) ) ),

        /*
        |----------------------------------------------------------------------
        | Excluded User Agents
        |----------------------------------------------------------------------
        |
        | User agent patterns to exclude from tracking (regex patterns).
        | Bots and crawlers are excluded by default.
        |
        */
        'excluded_user_agents' => [
            // Generic crawler tokens.
            '/bot/i',
            '/crawler/i',
            '/spider/i',
            '/slurp/i',
            '/mediapartners/i',
            '/applebot-extended/i',

            // SEO and marketing crawlers.
            '/semrushbot/i',
            '/ahrefsbot/i',
            '/mj12bot/i',
            '/dotbot/i',
            '/blexbot/i',
            '/screaming frog/i',
            '/rogerbot/i',
            '/sistrix/i',
            '/serpstatbot/i',
            '/dataforseobot/i',

            // AI training and answer-engine crawlers.
            '/gptbot/i',
            '/chatgpt-user/i',
            '/oai-searchbot/i',
            '/claudebot/i',
            '/claude-web/i',
            '/anthropic-ai/i',
            '/google-extended/i',
            '/gemini/i',
            '/amazonbot/i',
            '/bytespider/i',
            '/ccbot/i',
            '/cohere-ai/i',
            '/diffbot/i',
            '/facebookbot/i',
            '/perplexity/i',
            '/youbot/i',

            // Scraper, headless, and HTTP client patterns.
            '/headlesschrome/i',
            '/phantomjs/i',
            '/puppeteer/i',
            '/playwright/i',
            '/python-requests/i',
            '/go-http-client/i',
            '/java\//i',
            '/libwww-perl/i',
            '/curl\//i',
            '/wget\//i',
            '/httpx/i',
            '/aiohttp/i',
            '/scrapy/i',

            // Regional crawlers.
            '/sogou/i',
            '/yisou/i',
            '/360spider/i',
            '/seznambot/i',
            '/qwantify/i',
            '/naverbot/i',
            '/yeti/i',
            '/daumoa/i',
        ],

        /*
        |----------------------------------------------------------------------
        | Excluded Paths
        |----------------------------------------------------------------------
        |
        | URL paths to exclude from tracking. Supports wildcards (*).
        |
        */
        'excluded_paths' => [
            '/admin/*',
            '/api/*',
            '/_debugbar/*',
            '/telescope/*',
            '/horizon/*',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Bot Detection
    |--------------------------------------------------------------------------
    |
    | Settings for the multi-signal bot detection system. The BotDetector
    | service combines user agent, JavaScript fingerprint, engagement, and
    | request pattern signals into a confidence score (0-100). Visitors that
    | meet or exceed the threshold are considered bots.
    |
    */
    'bot_detection' => [
        /*
        |----------------------------------------------------------------------
        | Enabled
        |----------------------------------------------------------------------
        |
        | Master switch for behavioral bot detection. When disabled, the
        | BotDetector never flags visitors as bots.
        |
        */
        'enabled' => env( 'ANALYTICS_BOT_DETECTION_ENABLED', true ),

        /*
        |----------------------------------------------------------------------
        | Threshold
        |----------------------------------------------------------------------
        |
        | The minimum confidence score (0-100) required to flag a visitor as
        | a bot. Lower values are more aggressive; higher values reduce false
        | positives.
        |
        */
        'threshold' => env( 'ANALYTICS_BOT_DETECTION_THRESHOLD', 70 ),

        /*
        |----------------------------------------------------------------------
        | Whitelist
        |----------------------------------------------------------------------
        |
        | User agents and IP addresses that bypass bot scoring entirely.
        | User agents are matched as case-insensitive substrings; IPs must
        | match exactly.
        |
        */
        'whitelist' => [
            'user_agents' => [],
            'ips'         => [],
        ],

        /*
        |----------------------------------------------------------------------
        | Signals
        |----------------------------------------------------------------------
        |
        | Toggle individual signal categories on or off. Disabled categories
        | contribute zero points to the confidence score.
        |
        */
        'signals' => [
            'user_agent'       => true,
            'engagement'       => true,
            'request_patterns' => true,
            'js_fingerprint'   => true,
        ],

        /*
        |----------------------------------------------------------------------
        | Analysis Interval
        |----------------------------------------------------------------------
        |
        | How often, in minutes, the AnalyzeBotTraffic job runs to score recent
        | visitors. Used to build the scheduled job's cron expression. The value
        | is normalized down to the nearest divisor of 60 (1, 2, 3, 4, 5, 6, 10,
        | 12, 15, 20, or 30) so the job fires at an even cadence within the hour.
        |
        */
        'analysis_interval' => env( 'ANALYTICS_BOT_DETECTION_INTERVAL', 15 ),

        /*
        |----------------------------------------------------------------------
        | Analysis Window
        |----------------------------------------------------------------------
        |
        | How far back, in minutes, the AnalyzeBotTraffic job looks for unscored
        | visitors. Visitors last seen within this window that have not yet been
        | scored are evaluated on each run.
        |
        */
        'analysis_window' => env( 'ANALYTICS_BOT_DETECTION_WINDOW', 60 ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Data Retention
    |--------------------------------------------------------------------------
    |
    | Settings for data retention and cleanup.
    |
    */
    'retention' => [
        /*
        |----------------------------------------------------------------------
        | Retention Period
        |----------------------------------------------------------------------
        |
        | Number of days to retain raw analytics data. After this period,
        | data is either deleted or aggregated based on settings below.
        |
        */
        'period' => env( 'ANALYTICS_RETENTION_DAYS', 90 ),

        /*
        |----------------------------------------------------------------------
        | Aggregate Before Deletion
        |----------------------------------------------------------------------
        |
        | When enabled, data is aggregated into summary tables before
        | raw data is deleted, preserving historical trends.
        |
        */
        'aggregate_before_delete' => env( 'ANALYTICS_AGGREGATE_BEFORE_DELETE', true ),

        /*
        |----------------------------------------------------------------------
        | Aggregation Retention
        |----------------------------------------------------------------------
        |
        | Number of days to retain aggregated data. Set to 0 for indefinite.
        |
        */
        'aggregation_retention' => env( 'ANALYTICS_AGGREGATION_RETENTION', 0 ),

        /*
        |----------------------------------------------------------------------
        | Cleanup Schedule
        |----------------------------------------------------------------------
        |
        | Cron expression for when to run the cleanup job.
        |
        */
        'cleanup_schedule' => env( 'ANALYTICS_CLEANUP_SCHEDULE', '0 3 * * *' ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Inertia Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for Inertia.js dashboard rendering. These are only used when
    | dashboard_driver is set to 'inertia'.
    |
    */
    'inertia' => [
        /*
        |----------------------------------------------------------------------
        | Page Components
        |----------------------------------------------------------------------
        |
        | The Inertia page component names to render for each dashboard page.
        | These should match the component names in your React/Vue application.
        |
        */
        'pages' => [
            'dashboard' => env( 'ANALYTICS_INERTIA_DASHBOARD', 'Analytics/Dashboard' ),
            'pages'     => env( 'ANALYTICS_INERTIA_PAGES', 'Analytics/Pages' ),
            'traffic'   => env( 'ANALYTICS_INERTIA_TRAFFIC', 'Analytics/Traffic' ),
            'audience'  => env( 'ANALYTICS_INERTIA_AUDIENCE', 'Analytics/Audience' ),
            'events'    => env( 'ANALYTICS_INERTIA_EVENTS', 'Analytics/Events' ),
            'realtime'  => env( 'ANALYTICS_INERTIA_REALTIME', 'Analytics/Realtime' ),
        ],

        /*
        |----------------------------------------------------------------------
        | Share Analytics Data
        |----------------------------------------------------------------------
        |
        | When enabled, common analytics data (current site, consent status)
        | will be shared as Inertia shared props on all dashboard routes.
        |
        */
        'share_data' => env( 'ANALYTICS_INERTIA_SHARE_DATA', true ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Dashboard Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for the analytics dashboard.
    |
    */
    'dashboard' => [
        /*
        |----------------------------------------------------------------------
        | Default Date Range
        |----------------------------------------------------------------------
        |
        | The default date range to show on the dashboard (in days).
        |
        */
        'default_date_range' => env( 'ANALYTICS_DEFAULT_DATE_RANGE', 30 ),

        /*
        |----------------------------------------------------------------------
        | Cache Duration
        |----------------------------------------------------------------------
        |
        | How long to cache dashboard queries in seconds.
        |
        */
        'cache_duration' => env( 'ANALYTICS_CACHE_DURATION', 300 ),

        /*
        |----------------------------------------------------------------------
        | Real-time Enabled
        |----------------------------------------------------------------------
        |
        | Enable the real-time visitors widget on the dashboard.
        |
        */
        'realtime_enabled' => env( 'ANALYTICS_REALTIME_ENABLED', true ),

        /*
        |----------------------------------------------------------------------
        | Real-time Interval
        |----------------------------------------------------------------------
        |
        | How often to refresh real-time data in seconds.
        |
        */
        'realtime_interval' => env( 'ANALYTICS_REALTIME_INTERVAL', 30 ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting
    |--------------------------------------------------------------------------
    |
    | Settings for API rate limiting to prevent abuse.
    |
    */
    'rate_limiting' => [
        /*
        |----------------------------------------------------------------------
        | Enabled
        |----------------------------------------------------------------------
        |
        | Enable rate limiting on tracking endpoints.
        |
        */
        'enabled' => env( 'ANALYTICS_RATE_LIMIT_ENABLED', true ),

        /*
        |----------------------------------------------------------------------
        | Max Attempts
        |----------------------------------------------------------------------
        |
        | Maximum number of tracking requests per minute from a single IP.
        |
        */
        'max_attempts' => env( 'ANALYTICS_RATE_LIMIT_MAX', 60 ),

        /*
        |----------------------------------------------------------------------
        | Decay Minutes
        |----------------------------------------------------------------------
        |
        | Time window for rate limiting in minutes.
        |
        */
        'decay_minutes' => env( 'ANALYTICS_RATE_LIMIT_DECAY', 1 ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Multi-Tenant Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for multi-tenant (SaaS) deployments.
    |
    */
    'multi_tenant' => [
        /*
        |----------------------------------------------------------------------
        | Enabled
        |----------------------------------------------------------------------
        |
        | Enable multi-tenant support for analytics data isolation.
        |
        */
        'enabled' => env( 'ANALYTICS_MULTI_TENANT', false ),

        /*
        |----------------------------------------------------------------------
        | Tenant Identifier Column
        |----------------------------------------------------------------------
        |
        | The column name used to identify tenants in the database.
        |
        */
        'tenant_column' => env( 'ANALYTICS_TENANT_COLUMN', 'tenant_id' ),

        /*
        |----------------------------------------------------------------------
        | Tenant Resolver (Legacy)
        |----------------------------------------------------------------------
        |
        | Class responsible for resolving the current tenant. Must implement
        | ArtisanPackUI\Analytics\Contracts\TenantResolverInterface.
        |
        | Note: Consider using the 'resolvers' array below for more flexibility.
        |
        */
        'resolver' => env( 'ANALYTICS_TENANT_RESOLVER' ),

        /*
        |----------------------------------------------------------------------
        | Site Resolvers
        |----------------------------------------------------------------------
        |
        | Array of resolver classes to use for site resolution. Resolvers
        | are tried in priority order (lower numbers first).
        |
        | Available resolvers:
        | - ArtisanPackUI\Analytics\Resolvers\ApiKeyResolver (priority: 10)
        | - ArtisanPackUI\Analytics\Resolvers\HeaderResolver (priority: 50)
        | - ArtisanPackUI\Analytics\Resolvers\SubdomainResolver (priority: 90)
        | - ArtisanPackUI\Analytics\Resolvers\DomainResolver (priority: 100)
        |
        */
        'resolvers' => [
            ArtisanPackUI\Analytics\Resolvers\ApiKeyResolver::class,
            ArtisanPackUI\Analytics\Resolvers\HeaderResolver::class,
            ArtisanPackUI\Analytics\Resolvers\DomainResolver::class,
        ],

        /*
        |----------------------------------------------------------------------
        | Base Domain
        |----------------------------------------------------------------------
        |
        | The base domain for subdomain-based tenant resolution.
        | E.g., 'example.com' to resolve 'tenant.example.com'.
        |
        */
        'base_domain' => env( 'ANALYTICS_BASE_DOMAIN' ),

        /*
        |----------------------------------------------------------------------
        | Site Header
        |----------------------------------------------------------------------
        |
        | HTTP header name used for header-based site resolution.
        |
        */
        'site_header' => env( 'ANALYTICS_SITE_HEADER', 'X-Site-ID' ),

        /*
        |----------------------------------------------------------------------
        | Allow API Key in Query String
        |----------------------------------------------------------------------
        |
        | When enabled, API keys can be passed via query parameter (?api_key=xxx).
        | This is disabled by default because query parameters may be logged
        | in server access logs, creating a security risk. Enable only if you
        | have a specific need and understand the implications.
        |
        */
        'allow_query_api_key' => env( 'ANALYTICS_ALLOW_QUERY_API_KEY', false ),

        /*
        |----------------------------------------------------------------------
        | Default Site ID
        |----------------------------------------------------------------------
        |
        | Default site ID to use when no site can be resolved.
        |
        */
        'default_site_id' => env( 'ANALYTICS_DEFAULT_SITE_ID' ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Site Defaults
    |--------------------------------------------------------------------------
    |
    | Default settings for new sites. These values are used when a site
    | doesn't have a specific setting configured.
    |
    */
    'site_defaults' => [
        'tracking' => [
            'enabled'            => true,
            'respect_dnt'        => true,
            'anonymize_ip'       => true,
            'track_hash_changes' => false,
        ],
        'dashboard' => [
            'public'              => false,
            'default_date_range'  => 30,
            'realtime_enabled'    => true,
            'show_conversions'    => true,
            'show_goals'          => true,
        ],
        'privacy' => [
            'consent_required'        => false,
            'consent_cookie_lifetime' => 365,
            'excluded_paths'          => [],
            'excluded_ips'            => [],
        ],
        'features' => [
            'events'      => true,
            'goals'       => true,
            'conversions' => true,
            'heatmaps'    => false,
            'recordings'  => false,
            'funnels'     => true,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Event Tracking Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for custom event tracking.
    |
    */
    'events' => [
        /*
        |----------------------------------------------------------------------
        | Allowed Event Names
        |----------------------------------------------------------------------
        |
        | List of allowed event names. Set to empty array to allow all.
        | Helps prevent spam and invalid event tracking.
        |
        */
        'allowed_names' => [],

        /*
        |----------------------------------------------------------------------
        | Max Properties
        |----------------------------------------------------------------------
        |
        | Maximum number of custom properties allowed per event.
        |
        */
        'max_properties' => env( 'ANALYTICS_MAX_EVENT_PROPERTIES', 25 ),

        /*
        |----------------------------------------------------------------------
        | Max Property Value Length
        |----------------------------------------------------------------------
        |
        | Maximum length for event property values.
        |
        */
        'max_property_value_length' => env( 'ANALYTICS_MAX_PROPERTY_LENGTH', 500 ),

        /*
        |----------------------------------------------------------------------
        | Event Schema Validation
        |----------------------------------------------------------------------
        |
        | Define required properties for specific event types.
        | Events not listed here will allow any properties.
        |
        */
        'schema' => [
            'purchase' => [
                'required' => ['order_id', 'total'],
            ],
            'form_submitted' => [
                'required' => ['form_id'],
            ],
        ],

        /*
        |----------------------------------------------------------------------
        | Auto-Track Settings
        |----------------------------------------------------------------------
        |
        | Configure automatic event tracking features.
        |
        */
        'auto_track' => [
            'outbound_links'   => env( 'ANALYTICS_AUTO_TRACK_OUTBOUND', true ),
            'file_downloads'   => env( 'ANALYTICS_AUTO_TRACK_DOWNLOADS', true ),
            'scroll_depth'     => env( 'ANALYTICS_AUTO_TRACK_SCROLL', true ),
            'video_engagement' => env( 'ANALYTICS_AUTO_TRACK_VIDEO', false ),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Goals Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for conversion goals and tracking.
    |
    */
    'goals' => [
        /*
        |----------------------------------------------------------------------
        | Allow Multiple Conversions Per Session
        |----------------------------------------------------------------------
        |
        | When false, only one conversion per goal per session is recorded.
        | When true, multiple conversions of the same goal can be recorded
        | within a single session.
        |
        */
        'allow_multiple_per_session' => env( 'ANALYTICS_GOALS_MULTIPLE', false ),

        /*
        |----------------------------------------------------------------------
        | Cache Duration
        |----------------------------------------------------------------------
        |
        | How long to cache goal queries in seconds.
        |
        */
        'cache_duration' => env( 'ANALYTICS_GOALS_CACHE', 300 ),
    ],

    /*
    |--------------------------------------------------------------------------
    | JavaScript Tracker Configuration
    |--------------------------------------------------------------------------
    |
    | Settings for the JavaScript analytics tracker.
    |
    */
    'tracker' => [
        /*
        |----------------------------------------------------------------------
        | Tracker Script Path
        |----------------------------------------------------------------------
        |
        | Path to serve the JavaScript tracker script.
        |
        */
        'script_path' => env( 'ANALYTICS_TRACKER_PATH', '/js/analytics.js' ),

        /*
        |----------------------------------------------------------------------
        | Minified
        |----------------------------------------------------------------------
        |
        | Serve the minified version of the tracker script.
        |
        */
        'minified' => env( 'ANALYTICS_TRACKER_MINIFIED', true ),

        /*
        |----------------------------------------------------------------------
        | Track Hash Changes
        |----------------------------------------------------------------------
        |
        | Automatically track hash changes as page views (for SPAs).
        |
        */
        'track_hash_changes' => env( 'ANALYTICS_TRACK_HASH', false ),

        /*
        |----------------------------------------------------------------------
        | Track Outbound Links
        |----------------------------------------------------------------------
        |
        | Automatically track clicks on outbound links.
        |
        */
        'track_outbound_links' => env( 'ANALYTICS_TRACK_OUTBOUND', true ),

        /*
        |----------------------------------------------------------------------
        | Track File Downloads
        |----------------------------------------------------------------------
        |
        | Automatically track file download link clicks.
        |
        */
        'track_file_downloads' => env( 'ANALYTICS_TRACK_DOWNLOADS', true ),

        /*
        |----------------------------------------------------------------------
        | Download Extensions
        |----------------------------------------------------------------------
        |
        | File extensions to track as downloads.
        |
        */
        'download_extensions' => [
            'pdf',
            'doc',
            'docx',
            'xls',
            'xlsx',
            'zip',
            'rar',
            'gz',
            'tar',
            'exe',
            'dmg',
        ],
    ],
];
