<?php

declare(strict_types=1);

use App\Support\DateFormatter;

if (! function_exists('keystone')) {
    /**
     * Resolve a Keystone configuration value using dot-notation.
     *
     * Wraps `config('keystone.' . $key)` so callsites stay terse:
     * `keystone('features.blog')`, `keystone('limits.max_pages', 0)`.
     */
    function keystone(?string $key = null, mixed $default = null): mixed
    {
        if (null === $key) {
            $config = config('keystone', []);

            // Strip credential subtrees so a no-arg call cannot leak tokens
            // into logs, Inertia props, or API responses.
            unset(
                $config['updates']['gitlab_access_token'],
                $config['edge_cache']['cloudflare_api_token'],
            );

            return $config;
        }

        return config('keystone.'.$key, $default);
    }
}

if (! function_exists('keystone_format_date')) {
    /**
     * Format a date with the configured `general.dateFormat` setting.
     */
    function keystone_format_date(DateTimeInterface|string|null $value): ?string
    {
        return app(DateFormatter::class)->date($value);
    }
}

if (! function_exists('keystone_format_time')) {
    /**
     * Format a time with the configured `general.timeFormat` setting.
     */
    function keystone_format_time(DateTimeInterface|string|null $value): ?string
    {
        return app(DateFormatter::class)->time($value);
    }
}

if (! function_exists('keystone_format_datetime')) {
    /**
     * Format a combined date and time using both configured formats.
     */
    function keystone_format_datetime(DateTimeInterface|string|null $value): ?string
    {
        return app(DateFormatter::class)->dateTime($value);
    }
}
