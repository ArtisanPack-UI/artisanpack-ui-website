<?php

/**
 * Visual editor package configuration.
 *
 * Merged into the host application's `artisanpack.visual-editor` key by
 * VisualEditorServiceProvider. Applications override any of these values by
 * publishing this file to `config/artisanpack/visual-editor.php`.
 *
 * @package    ArtisanPack_UI
 * @subpackage VisualEditor
 *
 * @author     Jacob Martella <me@jacobmartella.com>
 *
 * @since      1.0.0
 */

declare( strict_types=1 );

return [

	/*
	|--------------------------------------------------------------------------
	| Resources
	|--------------------------------------------------------------------------
	|
	| Maps a URL-friendly slug to the Eloquent model class that backs it. The
	| editor's REST routes resolve `/visual-editor/api/{resource}/{id}/content`
	| through this map, so adding a new editable content type is a config
	| change — no per-model controllers required. Every listed model must use
	| the `HasBlockContent` trait.
	|
	*/

	'resources' => [
		// 'posts' => App\Models\Post::class,
		// 'pages' => App\Models\Page::class,
	],

	/*
	|--------------------------------------------------------------------------
	| Site meta
	|--------------------------------------------------------------------------
	|
	| Fallback values for the `core/site-title`, `core/site-tagline`, and
	| `core/site-logo` block resolvers. The Blade renderer reads these only
	| when `apGetSetting()` (cms-framework's settings helper) is unavailable;
	| the React/Vue renderers consume them via the `siteMeta` prop or the
	| bootstrap-time `setDefaultSiteMeta()` API. See plan 12 §4.3 for the
	| full G2 site-meta bridge contract.
	|
	| `logo_id` and `icon_id` are media-library media ids; the resolver
	| converts them to URLs via `apGetMediaUrl()` when present.
	|
	*/

	'site_meta' => [
		'title'       => null,
		'description' => null,
		'url'         => null,
		'logo_id'     => null,
		'icon_id'     => null,
	],

	/*
	|--------------------------------------------------------------------------
	| Block registry filters
	|--------------------------------------------------------------------------
	|
	| `enabled_blocks` acts as an allow-list: when non-empty, only the listed
	| block names are exposed to the inserter. `disabled_blocks` is an
	| always-applied deny-list. The deny-list wins when both are set. Use
	| fully-qualified block names (e.g. `artisanpack/paragraph`).
	|
	| I7 (#415) cutover: all blocks now use the `artisanpack/*` namespace.
	| `@wordpress/block-library`'s `registerCoreBlocks()` is no longer
	| called — the editor registers only the forked blocks discovered
	| under `resources/js/visual-editor/blocks/`. The deny-list is empty
	| because core/* blocks are never registered; blocks deferred to
	| future releases simply stay off the allow-list.
	|
	*/

	'enabled_blocks' => [
		// Content cluster — forked to artisanpack/* (I0 #408, I1 #409).
		// I7 (#415): core/* counterparts are no longer registered; only the
		// artisanpack/* forks surface in the inserter. The `from:core/*`
		// transforms still migrate existing core/* content on deserialize.
		'artisanpack/paragraph',
		'artisanpack/heading',
		'artisanpack/list',
		'artisanpack/quote',
		'artisanpack/code',
		'artisanpack/preformatted',
		'artisanpack/pullquote',
		'artisanpack/verse',
		'artisanpack/table',
		// Media cluster — forked to artisanpack/* (I2 #410).
		'artisanpack/image',
		'artisanpack/gallery',
		'artisanpack/video',
		'artisanpack/audio',
		'artisanpack/file',
		'artisanpack/embed',
		'artisanpack/cover',
		'artisanpack/media-text',
		// Entity cluster — forked to artisanpack/* (I5 #413). I7 (#415):
		// core/* counterparts are no longer registered; only the
		// artisanpack/* forks surface in the inserter. The forks read
		// entity data through the same core-data shim selectors the core
		// blocks used (#395 G0, #399 G3) and render server-side from
		// stamped _resolved* attributes. The `from:core/*` transforms
		// still migrate existing core/* content on deserialize.
		'artisanpack/template-part',
		'artisanpack/post-title',
		'artisanpack/post-content',
		'artisanpack/post-excerpt',
		'artisanpack/post-date',
		'artisanpack/post-author',
		'artisanpack/post-featured-image',
		'artisanpack/site-title',
		'artisanpack/site-tagline',
		'artisanpack/site-logo',
		'artisanpack/navigation',
		// G4b (#401) / I6 (#414) — taxonomy/feed widgets forked to
		// artisanpack/*, backed by cms-framework's term + post APIs
		// through the dynamic-block registry.
		'artisanpack/categories',
		'artisanpack/tag-cloud',
		'artisanpack/archives',
		// G4c-2 (#402) / I6 (#414) — query + post-template forked to
		// artisanpack/*. Pre-resolved server-side by `QueryInliner`
		// against cms-framework's `QueryRuntime`.
		'artisanpack/query',
		'artisanpack/post-template',
		// #521 — query family (no-results, pagination wrapper + leaves,
		// query-title). Pagination links / numbers / no-results state
		// and the query-title label are stamped by `QueryInliner`
		// alongside the per-iteration `_resolved*` attributes.
		'artisanpack/query-no-results',
		'artisanpack/query-pagination',
		'artisanpack/query-pagination-next',
		'artisanpack/query-pagination-numbers',
		'artisanpack/query-pagination-previous',
		'artisanpack/query-title',
		'artisanpack/callout',
		// Layout cluster — forked to artisanpack/* (I3 #411). `row` and
		// `stack` ship as variations of artisanpack/group (registered name
		// stays `artisanpack/group`), so they are not listed here.
		'artisanpack/group',
		'artisanpack/columns',
		'artisanpack/column',
		'artisanpack/buttons',
		'artisanpack/button',
		'artisanpack/separator',
		'artisanpack/spacer',
		'artisanpack/details',
		// Widgets cluster — forked to artisanpack/* (I4 #412).
		'artisanpack/search',
		'artisanpack/latest-posts',
	],

	'disabled_blocks' => [
		// I7 (#415): with the cutover to artisanpack/*, core/* blocks
		// are no longer registered. The deny-list is empty — all
		// artisanpack/* blocks surface through the `enabled_blocks`
		// allow-list above. Blocks deferred to future releases
		// (e.g. comments, V1.1+) simply stay off the allow-list.
	],

	/*
	|--------------------------------------------------------------------------
	| Media bridge
	|--------------------------------------------------------------------------
	|
	| The editor's media picker and upload plumbing route to whatever media
	| library the host application provides. The default integration is
	| `artisanpack-ui/media-library`: the host calls `registerMediaBridge`
	| with `MediaModal` and `uploadMedia` before `bootVisualEditor`. Any
	| library that exposes an equivalent picker component (props:
	| `open`, `onClose`, `onSelect`, `multiSelect`, `allowedTypes`,
	| `context`, `title`) and upload function (`(file, metadata?) =>
	| Promise<{ data: Media } | Media>`) can be swapped in — the
	| `media.bridge` key below records the active choice so server-side
	| code (for example the Featured Image hydration path) can pick the
	| matching PHP adapter from the container.
	|
	| Server-side record conversion is delegated to
	| `ArtisanPackUI\VisualEditor\MediaBridge\GutenbergAttachmentAdapter`.
	| Rebind that class in the container to override the Gutenberg shape
	| emitted by `toGutenberg()`; the default implementation duck-types
	| the `artisanpack-ui/media-library` Media model.
	|
	*/

	'media' => [
		'bridge'  => 'artisanpack-ui/media-library',
		'adapter' => \ArtisanPackUI\VisualEditor\MediaBridge\GutenbergAttachmentAdapter::class,
	],

	/*
	|--------------------------------------------------------------------------
	| API routes
	|--------------------------------------------------------------------------
	|
	| Middleware stack applied to the auto-registered `/visual-editor/api/*`
	| routes. The defaults cover a session-authenticated web app; API-only or
	| stateless apps can swap in `auth:sanctum`, `auth:api`, etc.
	|
	*/

	'api' => [
		'middleware' => [ 'api', 'auth' ],
	],

	/*
	|--------------------------------------------------------------------------
	| Authorization
	|--------------------------------------------------------------------------
	|
	| Controls how the default policy for the legacy VisualEditorPost model
	| gates access. Resource models (via `HasBlockContent`) delegate to their
	| own Laravel policies and ignore this flag.
	|
	*/

	'authorization' => [
		'restrict_by_owner' => false,
	],

	/*
	|--------------------------------------------------------------------------
	| Loginout block (#522)
	|--------------------------------------------------------------------------
	|
	| Configures the `artisanpack/loginout` block's server-side renderer.
	| Keystone ships Breeze-style `login` (GET) and `logout` (POST)
	| routes; the block emits a plain `<a>` so the logout link relies on
	| the host bridging GET → POST. Until that's wired (see the
	| `ap.visualEditor.loginout.envelope` filter), point `logout_path`
	| at a GET-friendly logout endpoint or set the URL through the filter.
	|
	*/

	'loginout' => [
		'guard'          => '',
		'login_route'    => 'login',
		'login_path'     => '/login',
		'logout_route'   => 'logout',
		'logout_path'    => '/logout',
		'redirect_param' => 'redirect_to',
	],

	/*
	|--------------------------------------------------------------------------
	| Global styles
	|--------------------------------------------------------------------------
	|
	| Configures the `globalStyles` entity the site editor customizes.
	| `theme` scopes the singleton lookup — each installed theme gets its
	| own global-styles record. `schema_version` pins the theme.json
	| schema the package accepts on `PUT` requests; see
	| `docs/global-styles.md` for the contract and how we handle future
	| upgrades. `base_path` is an absolute path to the PHP file returning
	| the default `base` payload (the theme.json defaults the site-editor
	| compares user overrides against); leave null to use the package's
	| bundled defaults.
	|
	*/

	'global_styles' => [
		'theme'          => 'artisanpack-base',
		'schema_version' => 3,
		'base_path'      => null,
	],

	/*
	|--------------------------------------------------------------------------
	| Site editor (H5)
	|--------------------------------------------------------------------------
	|
	| Static-config entry points for the five site-editor entity types. Each
	| key is also a filter slug — packages like cms-framework register their
	| entities at runtime through `addFilter('ap.visualEditor.{type}', ...)`.
	|
	| Static config wins on key collision: host-app entries listed here take
	| precedence over filter-supplied entries with the same key.
	|
	| Standalone visual-editor installs (no cms-framework, no host
	| registrations) leave these empty and the editor's site-editor surface
	| boots cleanly with no entities. See plan 14 §4.4 for the full filter
	| contract and the ResolvedX value-object shapes consumed by H6.
	|
	*/

	'site-editor' => [
		// array<string, array> keyed by template slug.
		// Each entry: { slug, theme, title, status, source, content: { raw, blocks }, has_theme_file, is_custom, wp_id?, ... }
		'templates' => [],

		// array<string, array> keyed by template-part slug.
		// Each entry adds: { area: 'header'|'footer'|'sidebar'|'general' }
		'template-parts' => [],

		// array<string, array> keyed by pattern slug.
		// Each entry: { slug, title, source: 'theme'|'user', synced, content: { raw, blocks }, categories?, block_types? }
		'patterns' => [],

		// array<string, mixed>|null — singleton, not a map.
		// { theme, settings, styles, variations? }
		'global-styles' => null,

		// array<string, array> keyed by theme-declared menu location.
		// Each entry: { location, name, items: [...] }
		'navigation' => [],
	],

];
