<?php

/**
 * SEO Package Configuration.
 *
 * This file contains all configurable options for the ArtisanPack UI SEO package.
 *
 * @package    ArtisanPack_UI
 * @subpackage SEO
 *
 * @since      1.0.0
 */

return [

	/*
	|--------------------------------------------------------------------------
	| Site Meta Information
	|--------------------------------------------------------------------------
	|
	| Default meta information for your site. These values are used when
	| specific page meta data is not available.
	|
	*/

	'site' => [
		'name'        => env( 'SEO_SITE_NAME', env( 'APP_NAME', 'Laravel' ) ),
		'description' => env( 'SEO_SITE_DESCRIPTION', '' ),
		'separator'   => env( 'SEO_TITLE_SEPARATOR', ' | ' ),
	],

	/*
	|--------------------------------------------------------------------------
	| Meta Tag Defaults
	|--------------------------------------------------------------------------
	|
	| Default values for meta tags when not specified by individual models.
	|
	*/

	'defaults' => [
		'robots'                 => env( 'SEO_DEFAULT_ROBOTS', 'index, follow' ),
		'title_max_length'       => 60,
		'description_max_length' => 160,
	],

	/*
	|--------------------------------------------------------------------------
	| Open Graph Settings
	|--------------------------------------------------------------------------
	|
	| Configuration for Open Graph meta tags (used by Facebook, LinkedIn, etc.).
	|
	*/

	'open_graph' => [
		'enabled'       => true,
		'type'          => 'website',
		'default_image' => null,
		'site_name'     => env( 'APP_NAME', 'Laravel' ),
	],

	/*
	|--------------------------------------------------------------------------
	| Twitter Card Settings
	|--------------------------------------------------------------------------
	|
	| Configuration for Twitter Card meta tags.
	|
	*/

	'twitter' => [
		'enabled'       => true,
		'card_type'     => 'summary_large_image',
		'site'          => null, // @username
		'creator'       => null, // @username
		'default_image' => null,
	],

	/*
	|--------------------------------------------------------------------------
	| Schema.org / JSON-LD Settings
	|--------------------------------------------------------------------------
	|
	| Configuration for structured data output.
	|
	*/

	'schema' => [
		'enabled'      => true,
		'organization' => [
			'name'  => env( 'APP_NAME', 'Laravel' ),
			'logo'  => null,
			'url'   => env( 'APP_URL', '' ),
			'email' => null,
			'phone' => null,
		],
		'default_types' => [
			'page'    => 'WebPage',
			'article' => 'Article',
			'product' => 'Product',
		],
	],

	/*
	|--------------------------------------------------------------------------
	| Sitemap Settings
	|--------------------------------------------------------------------------
	|
	| Configuration for XML sitemap generation.
	|
	*/

	'sitemap' => [
		'enabled'           => env( 'SEO_SITEMAP_ENABLED', true ),
		'route_enabled'     => true,
		'route_path'        => 'sitemap.xml',
		'max_urls_per_file' => 10000,
		'default_frequency' => 'weekly',
		'default_priority'  => 0.5,
		'cache_enabled'     => true,
		'cache_ttl'         => 3600, // 1 hour in seconds
		'submit_timeout'    => 10, // HTTP timeout for search engine pings
		'providers'         => [
			// Register sitemap content providers here
			// 'posts' => \App\Sitemap\PostSitemapProvider::class,
		],
		'types' => [
			'standard' => true,
			'image'    => false,
			'video'    => false,
			'news'     => false,
		],
		'news' => [
			'types'        => [ 'article', 'post', 'news' ], // Content types for news sitemap
			'max_age_days' => 2, // Google News only indexes last 2 days
		],
		'search_engines' => [
			// Custom search engine ping URLs (default: Google and Bing)
			// 'google' => 'https://www.google.com/ping?sitemap=%s',
			// 'bing'   => 'https://www.bing.com/ping?sitemap=%s',
		],
	],

	/*
	|--------------------------------------------------------------------------
	| Robots.txt Settings
	|--------------------------------------------------------------------------
	|
	| Configuration for dynamic robots.txt generation.
	|
	*/

	'robots' => [
		'enabled'       => true,
		'route_enabled' => true,
		'route_path'    => 'robots.txt',
		'cache_ttl'     => 3600, // 1 hour in seconds

		/*
		|--------------------------------------------------------------------------
		| Global Disallow/Allow Rules
		|--------------------------------------------------------------------------
		|
		| These rules apply to all user agents (*). For bot-specific rules,
		| use the 'rules' array below.
		|
		*/

		'disallow' => [
			'/admin',
			'/api',
		],
		'allow' => [],

		/*
		|--------------------------------------------------------------------------
		| Bot-Specific Rules
		|--------------------------------------------------------------------------
		|
		| Define rules for specific user agents. Each key is the user-agent
		| string (e.g., 'Googlebot', 'Bingbot', 'GPTBot').
		|
		| Example:
		| 'rules' => [
		|     'GPTBot' => [
		|         'disallow' => ['/'],  // Block AI crawlers from entire site
		|     ],
		|     'Googlebot' => [
		|         'allow' => ['/api/public'],
		|         'disallow' => ['/api/internal'],
		|         'crawl_delay' => 1,
		|     ],
		| ],
		|
		*/

		'rules' => [
			// 'GPTBot' => [
			//     'disallow' => ['/'],
			// ],
			// 'CCBot' => [
			//     'disallow' => ['/'],
			// ],
		],

		/*
		|--------------------------------------------------------------------------
		| Sitemap Configuration
		|--------------------------------------------------------------------------
		|
		| The sitemap_url is auto-generated from the sitemap route if null.
		| Use 'sitemaps' array to include multiple sitemap URLs.
		|
		*/

		'sitemap_url' => null, // Auto-generated if null
		'sitemaps'    => [], // Additional sitemap URLs

		/*
		|--------------------------------------------------------------------------
		| Host Directive
		|--------------------------------------------------------------------------
		|
		| The Host directive (used by some crawlers like Yandex).
		|
		*/

		'host' => null,
	],

	/*
	|--------------------------------------------------------------------------
	| Redirects Settings
	|--------------------------------------------------------------------------
	|
	| Configuration for URL redirect management.
	|
	*/

	'redirects' => [
		'enabled'            => env( 'SEO_REDIRECTS_ENABLED', true ),
		'middleware_enabled' => true,
		'cache_enabled'      => true,
		'cache_ttl'          => 86400, // 24 hours in seconds
		'track_hits'         => true,
		'max_chain_depth'    => 5,

		/*
		|--------------------------------------------------------------------------
		| Authorization Settings
		|--------------------------------------------------------------------------
		|
		| Configure authorization for the RedirectManager Livewire component.
		| Set 'authorization_enabled' to true and define the gate/ability name.
		|
		| Example setup in AuthServiceProvider:
		| Gate::define('manage-redirects', fn ($user) => $user->isAdmin());
		|
		*/

		'authorization_enabled' => false,
		'authorization_ability' => 'manage-redirects',
	],

	/*
	|--------------------------------------------------------------------------
	| SEO Analysis Settings
	|--------------------------------------------------------------------------
	|
	| Configuration for content SEO analysis features.
	|
	*/

	'analysis' => [
		'enabled'          => env( 'SEO_ANALYSIS_ENABLED', true ),
		'queue_enabled'    => false,
		'queue_connection' => null,
		'queue_name'       => 'seo',
		'cache_enabled'    => true,
		'cache_ttl'        => 86400, // 24 hours in seconds
		'analyzers'        => [
			'readability'       => true,
			'keyword_density'   => true,
			'focus_keyword'     => true,
			'meta_length'       => true,
			'heading_structure' => true,
			'image_alt'         => true,
			'internal_links'    => true,
			'content_length'    => true,
		],
		'thresholds' => [
			'min_word_count'      => 300,
			'max_keyword_density' => 3.0,
			'min_internal_links'  => 2,
		],
	],

	/*
	|--------------------------------------------------------------------------
	| Hreflang / Multi-language Settings
	|--------------------------------------------------------------------------
	|
	| Configuration for multi-language SEO support. Hreflang tags help search
	| engines serve the correct language or regional URL to users.
	|
	| 'enabled' - Set to true to enable hreflang functionality.
	| 'default_locale' - The primary locale, used for x-default if not explicitly set.
	| 'supported_locales' - Array of locale codes available for selection.
	|                       Leave empty to allow all common locales.
	| 'auto_add_x_default' - Automatically add x-default pointing to default_locale URL.
	|
	| Locale format examples:
	| - Language only: 'en', 'fr', 'de', 'es'
	| - Language-Region: 'en-US', 'en-GB', 'fr-FR', 'es-MX'
	| - x-default: Used for fallback/default language page
	|
	*/

	'hreflang' => [
		'enabled'            => false,
		'default_locale'     => 'en',
		'auto_add_x_default' => true,
		'supported_locales'  => [
			// Uncomment and customize the locales you need:
			// 'en',
			// 'en-US',
			// 'en-GB',
			// 'es',
			// 'es-ES',
			// 'es-MX',
			// 'fr',
			// 'fr-FR',
			// 'fr-CA',
			// 'de',
			// 'de-DE',
			// 'it',
			// 'it-IT',
			// 'pt',
			// 'pt-BR',
			// 'ja',
			// 'zh',
			// 'zh-CN',
			// 'zh-TW',
			// 'ko',
			// 'ar',
			// 'ru',
		],
	],

	/*
	|--------------------------------------------------------------------------
	| Cache Settings
	|--------------------------------------------------------------------------
	|
	| Global cache settings for all SEO features.
	|
	*/

	'cache' => [
		'enabled' => env( 'SEO_CACHE_ENABLED', true ),
		'ttl'     => env( 'SEO_CACHE_TTL', 3600 ),
		'driver'  => null, // Uses default cache driver if null
		'prefix'  => 'seo',
	],

	/*
	|--------------------------------------------------------------------------
	| API Settings
	|--------------------------------------------------------------------------
	|
	| Configuration for SEO package API endpoints.
	|
	*/

	'api' => [
		'enabled'    => true,
		'prefix'     => 'api/seo',
		'middleware' => [ 'api', 'auth:sanctum' ],
		'rate_limit' => 60, // Requests per minute
	],

];
