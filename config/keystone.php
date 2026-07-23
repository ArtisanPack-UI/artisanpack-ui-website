<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Site Type
    |--------------------------------------------------------------------------
    |
    | Identifies which Keystone product tier this install runs as.
    | Supported values: "sbdf_pro", "custom_crafted".
    |
    */

    'site_type' => env('KEYSTONE_SITE_TYPE', 'sbdf_pro'),

    /*
    |--------------------------------------------------------------------------
    | Feature Flags
    |--------------------------------------------------------------------------
    |
    | Capability toggles consumed by the `feature:<flag>` route middleware
    | and by the React shell to hide nav items. Defaults are conservative
    | (SBDF Pro). Custom Crafted installs flip ecommerce/booking on.
    |
    */

    'features' => [
        'blog'      => env('KEYSTONE_BLOG_ENABLED', true),
        'forms'     => env('KEYSTONE_FORMS_ENABLED', true),
        'analytics' => env('KEYSTONE_ANALYTICS_ENABLED', true),
        'ecommerce' => env('KEYSTONE_ECOMMERCE_ENABLED', false),
        'booking'   => env('KEYSTONE_BOOKING_ENABLED', false),
    ],

    /*
    |--------------------------------------------------------------------------
    | Editor Freedom
    |--------------------------------------------------------------------------
    |
    | Locks/unlocks visual editor escape hatches. SBDF Pro stays on rails;
    | Custom Crafted flips these on per agreement.
    |
    */

    'editor' => [
        'custom_css'               => env('KEYSTONE_CUSTOM_CSS', false),
        'freestyle_layout'         => env('KEYSTONE_FREESTYLE_LAYOUT', false),
        'show_responsive_controls' => env('KEYSTONE_SHOW_RESPONSIVE_CONTROLS', false),
    ],

    /*
    |--------------------------------------------------------------------------
    | Limits
    |--------------------------------------------------------------------------
    |
    | Hard caps enforced at the controller layer. Use null for unlimited.
    |
    */

    'limits' => [
        'max_pages'    => is_numeric(env('KEYSTONE_MAX_PAGES', 15)) ? (int) env('KEYSTONE_MAX_PAGES', 15) : null,
        'max_products' => is_numeric(env('KEYSTONE_MAX_PRODUCTS', 20)) ? (int) env('KEYSTONE_MAX_PRODUCTS', 20) : null,
        'max_forms'    => is_numeric(env('KEYSTONE_MAX_FORMS', 10)) ? (int) env('KEYSTONE_MAX_FORMS', 10) : null,
    ],

    /*
    |--------------------------------------------------------------------------
    | Edge Cache (Cloudflare)
    |--------------------------------------------------------------------------
    */

    'edge_cache' => [
        'enabled'             => env('KEYSTONE_EDGE_CACHE_ENABLED', true),
        'cloudflare_zone_id'  => env('CLOUDFLARE_ZONE_ID'),
        'cloudflare_api_token' => env('CLOUDFLARE_API_TOKEN'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Update Source
    |--------------------------------------------------------------------------
    |
    | Where the cms-framework Updates module pulls release tarballs from.
    |
    | - `source_url`: the GitLab project URL whose releases are pollable.
    | - `gitlab_access_token`: project access token used as `PRIVATE-TOKEN`
    |   against the GitLab API. Required for private repos.
    | - `strategy`: `release_asset` (default) selects the CI-built tarball
    |   via `cms.updates.gitlab_release_asset_pattern`, which the Keystone
    |   `.gitlab-ci.yml` `build_release` job uploads as a release asset.
    |   Fall back to `auto_archive` only for non-CI installs that ship the
    |   GitLab-generated source archive.
    | - `release_asset_pattern`: glob matched case-insensitively against the
    |   asset link name (defaults to the keystone-* tarball convention).
    | - `slug`: identifier used by the update checker cache key. Per-install
    |   should stay stable across releases.
    | - `backup_retention_days`: how long pre-update snapshot ZIPs live in
    |   `storage/backups/application/` before being pruned.
    |
    */

    'updates' => [
        'source_url'            => env('UPDATE_SOURCE_URL', 'https://gitlab.com/jacob-martella-web-design/jacob-martella-web-design/jmwd-keystone-cms/jmwd-keystone-cms'),
        'gitlab_access_token'   => env('GITLAB_ACCESS_TOKEN'),
        'strategy'              => env('GITLAB_UPDATE_STRATEGY', 'release_asset'),
        'release_asset_pattern' => env('GITLAB_RELEASE_ASSET_PATTERN', 'keystone-*.zip'),
        'slug'                  => env('KEYSTONE_UPDATE_SLUG', 'jmwd-keystone-cms'),
        'backup_retention_days' => max(
            1,
            is_numeric(env('BACKUP_RETENTION_DAYS', 30))
                ? (int) env('BACKUP_RETENTION_DAYS', 30)
                : 30
        ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Admin Bypass Role
    |--------------------------------------------------------------------------
    |
    | Users with this role bypass `feature:` middleware so the maintainer
    | (Jacob) can always reach disabled-feature routes for debugging.
    |
    */

    'admin_role' => env('KEYSTONE_ADMIN_ROLE', 'admin'),

    /*
    |--------------------------------------------------------------------------
    | Installer
    |--------------------------------------------------------------------------
    |
    | Controls the `installed` route middleware. The installer writes
    | `flag_path` once it completes; that file is the only signal the rest
    | of the app uses to know the site is set up. The token is required in
    | the URL of `/install` requests pre-install; the optional IP allowlist
    | locks the wizard to a known location during provisioning.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Plugins
    |--------------------------------------------------------------------------
    |
    | Keystone-side hardening for the framework's plugin subsystem. The
    | framework owns discovery/install/activation; this section covers the
    | trigger points Keystone exposes on top of it (admin.system.plugins.*).
    |
    | update_url_guard — pre-flight scheme/host validation for a plugin's
    | manifest-declared `update_url` before Keystone invokes the framework's
    | update-check or update dispatch. Blocks the trivial SSRF path (an
    | update_url pointing at 169.254.169.254 or a local admin). Note: this
    | does NOT cover the framework's follow-on fetch of `download_url` from
    | the update endpoint's response body — that has to be hardened
    | upstream. See issue #110.
    |
    | - allowed_schemes: comma-separated list, default `https`. Add `http`
    |   for dev if you point plugins at a local update server.
    | - allow_private_hosts: when true, bypasses the loopback/private/
    |   link-local host rejection. Keep false in production.
    | - allowed_hosts: comma-separated exact host allowlist. When set,
    |   requests to any other host are rejected even if scheme is valid.
    |   Leave empty to allow any public host.
    |
    */

    'plugins' => [
        'update_url_guard' => [
            'allowed_schemes' => array_values(array_filter(array_map(
                'trim',
                explode(',', (string) env('KEYSTONE_PLUGIN_UPDATE_URL_SCHEMES', 'https'))
            ))),
            'allow_private_hosts' => (bool) env('KEYSTONE_PLUGIN_UPDATE_URL_ALLOW_PRIVATE', false),
            'allowed_hosts'       => array_values(array_filter(array_map(
                'trim',
                explode(',', (string) env('KEYSTONE_PLUGIN_UPDATE_URL_ALLOWED_HOSTS', ''))
            ))),
        ],
    ],

    'install' => [
        'flag_path'    => env('KEYSTONE_INSTALL_FLAG_PATH', storage_path('app/.installed')),
        'token'        => env('KEYSTONE_INSTALL_TOKEN'),
        'ip_allowlist' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('KEYSTONE_INSTALL_IP_ALLOWLIST', ''))
        ))),
    ],

];
