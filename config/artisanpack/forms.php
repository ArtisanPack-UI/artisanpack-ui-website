<?php

/**
 * ArtisanPack UI Forms configuration.
 *
 * Defines all settings for the Forms package including storage, submissions,
 * spam protection, notification defaults, privacy settings, and authorization.
 *
 * @package    ArtisanPack_UI
 * @subpackage Forms
 *
 * @author     Jacob Martella <support@artisanpackui.dev>
 *
 * @since      1.0.0
 */
return [

    /*
    |--------------------------------------------------------------------------
    | Admin Interface Configuration
    |--------------------------------------------------------------------------
    |
    | Configure the admin interface for managing forms. You can customize the
    | route prefix, middleware, and pagination settings here.
    |
    */

    // Keystone owns /admin/forms via its own Inertia/React shell, so the
    // package's bundled Livewire admin routes are pushed to a disabled
    // prefix to avoid collisions. Do not link to these in the UI.
    'admin' => [
        'prefix'     => env( 'FORMS_ADMIN_PREFIX', '_pkg/forms-admin-disabled' ),
        'middleware' => ['web', 'auth'],
        'per_page'   => 15,
    ],

    /*
    |--------------------------------------------------------------------------
    | API Configuration
    |--------------------------------------------------------------------------
    |
    | Configure the REST API for the Forms package. The API provides
    | versioned endpoints for managing forms, fields, steps, submissions,
    | and notifications programmatically.
    |
    */

    'api' => [
        'enabled'    => env( 'FORMS_API_ENABLED', true ),
        'prefix'     => env( 'FORMS_API_PREFIX', 'api/v1/forms' ),
        'middleware' => ['api', 'auth:sanctum'],
        'per_page'   => 15,
    ],

    /*
    |--------------------------------------------------------------------------
    | Form Uploads Storage Configuration
    |--------------------------------------------------------------------------
    |
    | Configure the storage disk used for form file uploads. The default disk
    | is 'form-uploads' which stores files privately in storage/app/form-uploads.
    | You can change this to any configured disk in your filesystems.php.
    |
    */

    'uploads' => [
        'disk'          => env( 'FORMS_UPLOADS_DISK', 'form-uploads' ),
        'directory'     => env( 'FORMS_UPLOADS_DIRECTORY', 'uploads' ),
        'max_size'      => env( 'FORMS_UPLOADS_MAX_SIZE', 10240 ), // KB (10MB default)
        'allowed_mimes' => [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'text/plain',
            'text/csv',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Form Submissions Configuration
    |--------------------------------------------------------------------------
    |
    | Configure how form submissions are stored and managed. Set retention_days
    | to null to keep submissions forever, or specify a number of days after
    | which old submissions will be pruned.
    |
    */

    'submissions' => [
        'store_submissions'        => true,
        'retention_days'           => env( 'FORMS_RETENTION_DAYS', null ), // null = keep forever
        'submission_number_format' => 'FORM-{year}-{sequence}',
    ],

    /*
    |--------------------------------------------------------------------------
    | Spam Protection Configuration
    |--------------------------------------------------------------------------
    |
    | Configure spam protection features for forms. The honeypot field creates
    | a hidden field that bots typically fill out, and rate limiting prevents
    | rapid-fire submissions from the same IP address.
    |
    */

    'spam_protection' => [
        'honeypot' => [
            'enabled'    => true,
            'field_name' => 'website_url',
        ],
        // Per-form, per-IP throttle. 3 attempts per 60s is tight enough
        // to stunt brute spam without inconveniencing legitimate visitors
        // (who normally submit once and may retry on a validation error).
        // The package keys the bucket by `{formId}:{ip}` so one popular
        // form being attacked does not share quota with the others.
        'rate_limit' => [
            'enabled'  => true,
            'attempts' => 3,
            'decay'    => 60,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Notification Defaults
    |--------------------------------------------------------------------------
    |
    | Default values for form notifications. These can be overridden per-form
    | in the notification configuration. If null, defaults to app.name and
    | mail.from.address respectively at runtime.
    |
    */

    'notifications' => [
        'from_name'         => env( 'FORMS_FROM_NAME' ),
        'from_email'        => env( 'FORMS_FROM_EMAIL' ),
        'queue'             => env( 'FORMS_NOTIFICATION_QUEUE', 'default' ),
        'show_ip_in_emails' => env( 'FORMS_SHOW_IP_IN_EMAILS', true ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Form Display Defaults
    |--------------------------------------------------------------------------
    |
    | Default display settings for new forms. These can be overridden per-form.
    |
    */

    'display' => [
        'label_position'          => 'above', // 'above', 'beside', 'hidden'
        'show_required_indicator' => true,
        'required_indicator'      => '*',
        'error_display'           => 'below', // 'below', 'tooltip', 'summary'
    ],

    /*
    |--------------------------------------------------------------------------
    | Webhook Configuration
    |--------------------------------------------------------------------------
    |
    | Configure global webhook settings for form submissions. Webhooks can also
    | be configured per-form in the form's settings. The global webhook is sent
    | for all form submissions if enabled.
    |
    */

    'webhooks' => [
        'enabled'       => env( 'FORMS_WEBHOOKS_ENABLED', false ),
        'url'           => env( 'FORMS_WEBHOOK_URL' ),
        'secret'        => env( 'FORMS_WEBHOOK_SECRET' ),
        'queue'         => env( 'FORMS_WEBHOOK_QUEUE', 'default' ),
        'timeout'       => env( 'FORMS_WEBHOOK_TIMEOUT', 30 ),
        'retry_times'   => 3,
        'retry_backoff' => [10, 60, 300], // seconds
    ],

    /*
    |--------------------------------------------------------------------------
    | Integration Settings
    |--------------------------------------------------------------------------
    |
    | Configure settings for third-party integrations. Integration packages
    | can register their own settings via the 'forms.settings_tabs' filter hook.
    |
    */

    'integrations' => [
        // Enable or disable the integration settings panel
        'enabled' => true,
    ],

    /*
    |--------------------------------------------------------------------------
    | Privacy Settings
    |--------------------------------------------------------------------------
    |
    | Configure privacy settings for handling personally identifiable information
    | (PII) in submissions, exports and webhooks. These settings help comply with
    | privacy regulations like GDPR.
    |
    */

    'privacy' => [
        // Submission metadata settings (what gets stored in the database)
        'submission' => [
            // Include IP address in submission metadata
            'include_ip' => env( 'FORMS_INCLUDE_IP', true ),

            // Anonymize IP addresses by masking the last octet (e.g., 192.168.1.x becomes 192.168.1.0).
            // Default flipped to `true` in Keystone for GDPR posture — the
            // exact IP is rarely the right primary key for abuse triage
            // (rate-limit cache already keys by full IP at request time;
            // only the stored value is masked).
            'anonymize_ip' => env( 'FORMS_ANONYMIZE_IP', true ),

            // Include user agent in submission metadata
            'include_user_agent' => env( 'FORMS_INCLUDE_USER_AGENT', true ),
        ],

        // Webhook/Export settings (what gets sent externally) - defaults to false for privacy
        'include_ip_address' => env( 'FORMS_INCLUDE_IP_ADDRESS', false ),
        'include_user_agent' => env( 'FORMS_WEBHOOK_INCLUDE_USER_AGENT', false ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Export Settings
    |--------------------------------------------------------------------------
    |
    | Configure settings for exporting form submissions to CSV and other formats.
    | These settings control localization and data format preferences for exports.
    |
    */

    'export' => [
        // Localize export headers (e.g., "Submission ID" vs English literals)
        // When false, headers use stable English strings for machine processing
        'localize_headers' => env( 'FORMS_EXPORT_LOCALIZE_HEADERS', false ),

        // Localize boolean values in exports (e.g., "Yes"/"No" vs 1/0)
        // When false, booleans export as 1/0 for consistent machine parsing
        'localize_booleans' => env( 'FORMS_EXPORT_LOCALIZE_BOOLEANS', false ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Security Settings
    |--------------------------------------------------------------------------
    |
    | Configure security-related settings including logging of security events.
    | Security events include honeypot triggers, rate limiting, and invalid
    | file upload attempts.
    |
    */

    'security' => [
        // Enable logging of security events (honeypot, rate limiting, invalid files)
        'logging_enabled' => env( 'FORMS_SECURITY_LOGGING', true ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Authorization Settings
    |--------------------------------------------------------------------------
    |
    | Configure authorization behavior for forms and submissions. By default,
    | ownership checks are disabled (permissive mode) for backwards compatibility.
    |
    | SECURITY WARNING: The default permissive mode allows any authenticated user
    | to access, modify, or delete any form. For production applications with
    | multiple users, enable ownership enforcement or override the policies.
    |
    | Options:
    | - restrict_by_owner: When true, forms can only be modified by their owner
    | - allow_admin_bypass: When true, users with is_admin=true bypass ownership
    | - user_model: The fully qualified class name of your User model
    |
    */

    'authorization' => [
        // Ownership-based access control. Defaults to enabled so a fresh
        // install doesn't accidentally ship a permissive multi-tenant
        // posture (any authenticated user managing any form). Combined
        // with `allow_admin_bypass`, admins still see everything while
        // editors are scoped to forms they authored — set the env var
        // to `false` to disable the check entirely.
        'restrict_by_owner' => env( 'FORMS_RESTRICT_BY_OWNER', true ),

        // Allow users with is_admin attribute to bypass ownership checks
        'allow_admin_bypass' => env( 'FORMS_ALLOW_ADMIN_BYPASS', true ),

        // The user model class for ownership relationships
        'user_model' => env( 'FORMS_USER_MODEL', 'App\\Models\\User' ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disk Configuration
    |--------------------------------------------------------------------------
    |
    | This configuration will be merged into the filesystems.disks config
    | when the package service provider boots. If you want to use a different
    | disk configuration, you can override this in your filesystems.php.
    |
    */

    'disk_config' => [
        'form-uploads' => [
            'driver'     => 'local',
            'root'       => storage_path( 'app/form-uploads' ),
            'visibility' => 'private',
        ],
    ],

];
