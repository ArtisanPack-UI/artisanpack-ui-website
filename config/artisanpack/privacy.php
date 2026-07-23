<?php

/**
 * Privacy package configuration.
 *
 * Controls regulation coverage, consent storage, cookie categories, data
 * subject request handling, deletion/anonymization strategies, geolocation,
 * UI presentation, routing, and admin dashboard access.
 *
 * @package    ArtisanPack_UI
 * @subpackage Privacy
 *
 * @author     Jacob Martella <me@jacobmartella.com>
 *
 * @since      1.0.0
 */

declare( strict_types=1 );

return [

	/*
	|--------------------------------------------------------------------------
	| Package Toggle
	|--------------------------------------------------------------------------
	|
	| Master switch for the package. Disabling skips migration loading,
	| route registration, and middleware aliasing in the service provider.
	|
	*/
	'enabled' => env( 'PRIVACY_ENABLED', true ),

	/*
	|--------------------------------------------------------------------------
	| Cache TTLs
	|--------------------------------------------------------------------------
	|
	| TTL (in seconds) for in-memory caches that protect hot read paths from
	| repeated DB hits. `consent_ttl` covers per-subject consent lookups,
	| `policy_ttl` covers the active-policy resolver used by the reconsent
	| middleware, and `banner_ttl` covers the per-subject expired-consent
	| probe rendered on every page that mounts the cookie banner.
	|
	*/
	'cache' => [
		'consent_ttl' => (int) env( 'PRIVACY_CACHE_CONSENT_TTL', 300 ),
		'policy_ttl'  => (int) env( 'PRIVACY_CACHE_POLICY_TTL', 600 ),
		'banner_ttl'  => (int) env( 'PRIVACY_CACHE_BANNER_TTL', 60 ),
	],

	/*
	|--------------------------------------------------------------------------
	| Enabled Regulations
	|--------------------------------------------------------------------------
	|
	| Specify which privacy regulations the application needs to comply with.
	| This affects consent requirements, user rights, and notification rules.
	|
	*/
	'regulations' => [
		'gdpr' => [
			'enabled'                   => env( 'PRIVACY_GDPR_ENABLED', true ),
			'applies_to'                => [ 'EU', 'EEA', 'UK' ],
			'consent_expiry_days'       => 365,
			'breach_notification_hours' => 72,
		],
		'ccpa' => [
			'enabled'             => env( 'PRIVACY_CCPA_ENABLED', true ),
			'applies_to'          => [ 'US-CA' ],
			'opt_out_sale'        => true,
			'financial_threshold' => 25000000,
		],
		'lgpd' => [
			'enabled'    => env( 'PRIVACY_LGPD_ENABLED', true ),
			'applies_to' => [ 'BR' ],
		],
		'pipeda' => [
			'enabled'    => env( 'PRIVACY_PIPEDA_ENABLED', true ),
			'applies_to' => [ 'CA' ],
		],
	],

	/*
	|--------------------------------------------------------------------------
	| Consent Storage
	|--------------------------------------------------------------------------
	|
	| Configure how user consent is persisted. The `storage` driver chooses
	| between database-only, cookie-only, or both for layered persistence.
	|
	*/
	'consent' => [
		'storage'                => env( 'PRIVACY_CONSENT_STORAGE', 'both' ),
		'cookie_name'            => env( 'PRIVACY_CONSENT_COOKIE', 'privacy_consent' ),
		'cookie_lifetime'        => (int) env( 'PRIVACY_CONSENT_COOKIE_LIFETIME', 365 ),
		'require_authentication' => false,
		'guest_identifier'       => 'fingerprint',
	],

	/*
	|--------------------------------------------------------------------------
	| Cookie Categories
	|--------------------------------------------------------------------------
	|
	| Define the cookie consent categories presented to users. The `necessary`
	| category should always remain required.
	|
	*/
	'cookie_categories' => [
		'necessary' => [
			'name'        => 'Strictly Necessary',
			'description' => 'Essential cookies required for the website to function properly.',
			'required'    => true,
			'cookies'     => [ 'session', 'csrf', 'privacy_consent' ],
		],
		'functional' => [
			'name'        => 'Functional',
			'description' => 'Cookies that enable enhanced functionality and personalization.',
			'required'    => false,
			'cookies'     => [ 'language', 'timezone', 'preferences' ],
		],
		'analytics' => [
			'name'        => 'Analytics',
			'description' => 'Cookies that help us understand how visitors use our website.',
			'required'    => false,
			'cookies'     => [ '_ga', '_gid', '_gat' ],
		],
		'marketing' => [
			'name'        => 'Marketing',
			'description' => 'Cookies used to deliver relevant advertisements.',
			'required'    => false,
			'cookies'     => [ '_fbp', 'fr' ],
		],
	],

	/*
	|--------------------------------------------------------------------------
	| Data Subject Rights
	|--------------------------------------------------------------------------
	|
	| Configure how data subject requests (access, deletion, export,
	| rectification) are received and processed.
	|
	*/
	'data_requests' => [
		'enabled'              => true,
		'require_verification' => true,
		'verification_method'  => env( 'PRIVACY_VERIFICATION_METHOD', 'email' ),

		/*
		| Request types the package will accept on the JSON endpoint and the
		| Livewire/React/Vue forms. Remove a type from this list to disable
		| it everywhere — the JSON validator enforces the same allowlist as
		| the UI, so clients cannot bypass a UI restriction via curl.
		*/
		'allowed_types' => [ 'access', 'export', 'deletion', 'rectification' ],

		'auto_process' => [
			'access'   => true,
			'export'   => true,
			'deletion' => false,
		],
		'response_days' => [
			'gdpr'    => 30,
			'ccpa'    => 45,
			'default' => 30,
		],
		'export_format' => env( 'PRIVACY_EXPORT_FORMAT', 'json' ),
		'notify_admin'  => true,
		'admin_email'   => env( 'PRIVACY_ADMIN_EMAIL' ),

		/*
		| Per-user rate limit applied to the JSON `/data-requests` endpoints
		| (both index and store) as `hits,minutes`. Keyed by authenticated
		| user when present, otherwise by IP. Tune down for tighter
		| enumeration protection; tune up for high-traffic dashboard
		| polling.
		*/
		'api_rate_limit' => env( 'PRIVACY_DATA_REQUESTS_API_RATE_LIMIT', '60,1' ),
	],

	/*
	|--------------------------------------------------------------------------
	| Notifications
	|--------------------------------------------------------------------------
	|
	| Channels and queue used by the package's data-request notifications.
	| Each notification key (received/verification/processing/completed/
	| rejected/admin) may override the channel list independently.
	|
	*/
	'notifications' => [
		'queue'    => env( 'PRIVACY_NOTIFICATIONS_QUEUE', 'default' ),
		'channels' => [ 'mail', 'database' ],

		'received'     => [ 'channels' => [ 'mail', 'database' ] ],
		'verification' => [ 'channels' => [ 'mail' ] ],
		'processing'   => [ 'channels' => [ 'database' ] ],
		'completed'    => [ 'channels' => [ 'mail', 'database' ] ],
		'rejected'     => [ 'channels' => [ 'mail', 'database' ] ],
		'admin'        => [ 'channels' => [ 'mail' ] ],
	],

	/*
	|--------------------------------------------------------------------------
	| Data Export
	|--------------------------------------------------------------------------
	|
	| File storage and signed-URL settings for `DataExportService::exportToFile()`.
	|
	*/
	'export' => [
		'disk'                    => env( 'PRIVACY_EXPORT_DISK', 'local' ),
		'directory'               => 'privacy-exports',
		'url_ttl'                 => (int) env( 'PRIVACY_EXPORT_URL_TTL', 60 ),
		'file_retention_minutes'  => (int) env( 'PRIVACY_EXPORT_RETENTION_MINUTES', 1440 ),

		/*
		| Per-section row cap for export collection (consent history,
		| activity log, data-request summary). Prevents OOM for very
		| high-volume subjects. Raise if your compliance posture requires
		| a complete export regardless of size.
		*/
		'row_cap' => (int) env( 'PRIVACY_EXPORT_ROW_CAP', 50000 ),
	],

	/*
	|--------------------------------------------------------------------------
	| Identity Verification
	|--------------------------------------------------------------------------
	|
	| Settings for the data subject identity-verification flow that gates
	| access/deletion/export requests. The token is stored on the request
	| row and confirmed via the configured channel.
	|
	*/
	'verification' => [
		'token_ttl_minutes' => (int) env( 'PRIVACY_VERIFICATION_TTL', 60 ),
		'rate_limit'        => env( 'PRIVACY_VERIFICATION_RATE_LIMIT', '6,1' ),
	],

	/*
	|--------------------------------------------------------------------------
	| Data Deletion Strategies
	|--------------------------------------------------------------------------
	|
	| Defaults applied when the package handles a deletion request without
	| a more specific per-field strategy.
	|
	*/
	'deletion' => [
		'default_strategy'  => env( 'PRIVACY_DELETION_STRATEGY', 'anonymize' ),
		'cascade'           => true,
		'preserve_audit'    => true,
		'grace_period_days' => (int) env( 'PRIVACY_DELETION_GRACE_DAYS', 30 ),
	],

	/*
	|--------------------------------------------------------------------------
	| Anonymization Settings
	|--------------------------------------------------------------------------
	|
	| Per-field strategies used when anonymizing personal data. Strategy
	| names map to AnonymizationService methods.
	|
	*/
	'anonymization' => [
		'strategies' => [
			'email'         => 'mask',
			'name'          => 'pseudonymize',
			'phone'         => 'redact',
			'address'       => 'generalize',
			'ip_address'    => 'truncate',
			'date_of_birth' => 'generalize',
		],
		'hash_algorithm'          => 'sha256',
		'pseudonymization_prefix' => 'Anon_',

		/*
		| Emit an audit-log entry (Log::info on the `privacy.anonymization`
		| channel) every time a model has at least one field anonymized.
		| Records only model class, primary key, and column names — never
		| the original or transformed values.
		*/
		'audit' => true,
	],

	/*
	|--------------------------------------------------------------------------
	| Personal Data Discovery
	|--------------------------------------------------------------------------
	|
	| Settings for the personal data scanner that maps which models hold
	| which sensitive fields.
	|
	*/
	'discovery' => [
		'auto_scan'  => true,
		'scan_paths' => [
			app_path( 'Models' ),
		],
		'exclude_models' => [],
		'field_patterns' => [
			'email'   => [ 'email', 'e_mail', 'email_address' ],
			'name'    => [ 'name', 'first_name', 'last_name', 'full_name' ],
			'phone'   => [ 'phone', 'telephone', 'mobile', 'cell' ],
			'address' => [ 'address', 'street', 'city', 'zip', 'postal' ],
			'ip'      => [ 'ip', 'ip_address', 'ipaddress' ],
			'ssn'     => [ 'ssn', 'social_security', 'tax_id' ],
		],
	],

	/*
	|--------------------------------------------------------------------------
	| Geolocation
	|--------------------------------------------------------------------------
	|
	| Used by the regulation resolver to select the applicable regulation
	| based on the visitor's region.
	|
	*/
	'geolocation' => [
		'enabled'         => env( 'PRIVACY_GEOLOCATION_ENABLED', true ),
		'provider'        => env( 'PRIVACY_GEOLOCATION_PROVIDER', 'ip-api' ),
		'cache_duration'  => 1440,
		'fallback_region' => env( 'PRIVACY_FALLBACK_REGION' ),

		/*
		| MaxMind GeoIP2 database path, used when `provider` is set to
		| `maxmind`. Requires the `geoip2/geoip2` Composer package; resolve
		| the path with `storage_path()` so the database can live outside
		| the repo.
		*/
		'maxmind' => [
			'database' => env( 'PRIVACY_MAXMIND_DATABASE' ),
		],

		/*
		| ip-api.com base URL. Defaults to the Pro HTTPS endpoint so
		| geolocation traffic is encrypted out of the box. Operators on the
		| free tier (which does not support HTTPS) must opt-in explicitly
		| by setting `PRIVACY_IP_API_BASE_URL=http://ip-api.com` — be aware
		| that this leaks the visitor's IP to a third party in cleartext.
		*/
		'ip_api' => [
			'base_url' => env( 'PRIVACY_IP_API_BASE_URL', 'https://pro.ip-api.com' ),
		],

		/*
		| Cloudflare-specific settings used when `provider = cloudflare`.
		| `trust_header` lets the service honour `CF-IPCountry` even on a
		| stack without Laravel's TrustProxies middleware wired up — set
		| this to true ONLY when you are certain the request can only
		| reach the application through Cloudflare. Otherwise the service
		| falls back to `Request::isFromTrustedProxy()`.
		*/
		'cloudflare' => [
			'trust_header' => env( 'PRIVACY_CLOUDFLARE_TRUST_HEADER', false ),
		],
	],

	/*
	|--------------------------------------------------------------------------
	| UI Settings
	|--------------------------------------------------------------------------
	|
	| Controls the appearance of the cookie banner and preferences UI.
	|
	*/
	'ui' => [
		'cookie_banner' => [
			'position'        => 'bottom',
			'style'           => 'bar',
			'show_reject_all' => true,
			'show_customize'  => true,
			'blur_background' => false,
		],
		'policy' => [
			'custom_css_class'      => env( 'PRIVACY_POLICY_VIEW_CLASS', '' ),
			'show_version_history'  => true,
			'show_locale_switcher'  => true,
		],

		/*
		| Banner-wide presentation toggles consumed by both the Livewire
		| views and their React/Vue counterparts so customising one stays
		| in sync with the other. `use_daisyui` allows applications that
		| don't ship daisyUI to opt out of the default button classes.
		*/
		'animation'       => env( 'PRIVACY_UI_ANIMATION', 'slide-up' ),
		'z_index'         => (int) env( 'PRIVACY_UI_Z_INDEX', 9999 ),
		'custom_css_class' => env( 'PRIVACY_UI_CUSTOM_CLASS', '' ),
		'use_daisyui'     => env( 'PRIVACY_UI_USE_DAISYUI', true ),
		'theme'           => 'auto',
	],

	/*
	|--------------------------------------------------------------------------
	| Policy Lifecycle
	|--------------------------------------------------------------------------
	|
	| Controls the public-facing policy display and the re-consent workflow.
	| `reconsent_grace_period_days` allows users to keep using the
	| application while they review a new policy; `block_on_no_reconsent`
	| escalates to a hard block once the grace period elapses.
	|
	*/
	'policy' => [
		'path'                        => env( 'PRIVACY_POLICY_PATH', 'policy' ),
		'reconsent_path'              => env( 'PRIVACY_RECONSENT_PATH', 'reconsent' ),
		'reconsent_grace_period_days' => (int) env( 'PRIVACY_RECONSENT_GRACE_DAYS', 30 ),
		'block_on_no_reconsent'       => (bool) env( 'PRIVACY_RECONSENT_BLOCK', false ),
		'retention_account_days'      => (int) env( 'PRIVACY_RETENTION_ACCOUNT_DAYS', 90 ),
		'blocked_response' => [
			'status'         => 403,
			'redirect_route' => 'privacy.policy.show',
			'message'        => 'You must accept the updated privacy policy to continue.',
		],
	],

	/*
	|--------------------------------------------------------------------------
	| Routes
	|--------------------------------------------------------------------------
	|
	| Routing configuration for both the public web routes and the JSON API.
	|
	*/
	'routes' => [
		'enabled'    => true,
		'prefix'     => 'privacy',
		'middleware' => [ 'web' ],
		'api_prefix' => 'api/privacy',

		/*
		| The consent endpoints rely on session and cookie middleware so
		| Auth::user() resolves and the consent cookie is readable, so
		| `web` is the right default for stateful applications. Swap to
		| `api` (or your own stack) only if you've layered session/cookie
		| handling in elsewhere — for example via Sanctum's stateful
		| middleware on an SPA route.
		*/
		'api_middleware' => [ 'web' ],
	],

	/*
	|--------------------------------------------------------------------------
	| Scheduling
	|--------------------------------------------------------------------------
	|
	| Schedule entries the package adds to Laravel's scheduler automatically.
	| Set `enabled` to false to opt out and run the command from your own
	| scheduler configuration (`bootstrap/app.php` `->withSchedule()` in
	| Laravel 11+, or a service-provider `Schedule` binding) instead.
	|
	*/
	'scheduling' => [
		/*
		| Keystone wires every recurring privacy command explicitly in
		| App\Providers\PrivacyServiceProvider so the schedule is discoverable
		| in one place. Leaving the package's built-in auto-registration on
		| would double-book the purge command, so it's disabled here.
		*/
		'purge_expired' => [
			'enabled'  => false,
			'cron'     => '0 3 * * *',
			'prune'    => false,
			'timezone' => null,
		],
	],

	/*
	|--------------------------------------------------------------------------
	| Middleware
	|--------------------------------------------------------------------------
	|
	| Behaviour for the `privacy.consent` route guard. `action` decides what
	| happens when a required category is missing: `abort` returns the HTTP
	| status below; `redirect` sends the visitor to `redirect_route` (when
	| set) or `redirect_url`.
	|
	*/
	'middleware' => [
		'ensure_consent' => [
			'action'         => env( 'PRIVACY_CONSENT_MIDDLEWARE_ACTION', 'abort' ),
			'status'         => 403,
			'message'        => 'Consent required.',
			'redirect_route' => null,
			'redirect_url'   => '/',
		],
	],

	/*
	|--------------------------------------------------------------------------
	| Admin Dashboard
	|--------------------------------------------------------------------------
	|
	| Authorization for the admin dashboard. Override the `gate` in your
	| application's AuthServiceProvider to grant access.
	|
	*/
	'admin' => [
		/*
		| Keystone replaces the package's Livewire admin dashboard with
		| the Inertia/React screens under `resources/js/pages/admin/privacy`
		| (see `App\Http\Controllers\Admin\PrivacyAdminController`), so we
		| turn the vendor's admin web routes off to avoid a route-name
		| collision under the same `admin/privacy` prefix. The JSON API
		| under `/api/privacy/admin/*` (governed by `routes.enabled`)
		| stays on so the React pages can still reach the package's
		| services.
		*/
		'enabled'        => false,
		'route_prefix'   => 'admin/privacy',
		'middleware'     => [ 'web', 'auth' ],
		'gate'           => 'manage-privacy',
		/*
		| Rate limit applied to every admin JSON API endpoint under the
		| `api/privacy/admin` prefix. Format: `requests,minutes`.
		*/
		'api_rate_limit' => env( 'PRIVACY_ADMIN_API_RATE_LIMIT', '120,1' ),
	],

	/*
	|--------------------------------------------------------------------------
	| Breach Notification
	|--------------------------------------------------------------------------
	|
	| Configures the authority notification recipient and the organization
	| metadata interpolated into the publishable breach notification
	| templates. Per-regulation notification windows (e.g. GDPR's 72 hours)
	| are configured under `regulations.{key}.breach_notification_hours`.
	|
	*/
	'breach' => [
		'authority_email' => env( 'PRIVACY_BREACH_AUTHORITY_EMAIL' ),
		'organization'    => [
			'name'    => env( 'PRIVACY_BREACH_ORG_NAME', env( 'APP_NAME', 'Our organization' ) ),
			'address' => env( 'PRIVACY_BREACH_ORG_ADDRESS' ),
			'website' => env( 'PRIVACY_BREACH_ORG_WEBSITE', env( 'APP_URL' ) ),
			'contact' => env( 'PRIVACY_BREACH_ORG_CONTACT' ),
		],
		'dpo' => [
			'name'  => env( 'PRIVACY_BREACH_DPO_NAME' ),
			'email' => env( 'PRIVACY_BREACH_DPO_EMAIL' ),
			'phone' => env( 'PRIVACY_BREACH_DPO_PHONE' ),
		],
	],

];
