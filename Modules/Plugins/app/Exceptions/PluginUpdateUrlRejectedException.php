<?php

declare(strict_types=1);

namespace Modules\Plugins\Exceptions;

use RuntimeException;

/**
 * Thrown by PluginUpdateUrlGuard when a plugin's manifest-declared
 * `update_url` fails Keystone's pre-flight validation (unsafe scheme,
 * private/loopback host, or non-allowlisted host).
 *
 * The message is intended to be admin-facing — surfaced as an inline
 * error on the plugins admin page. The `reason` code is a stable slug
 * safe to include in structured logs (the full URL is not — it may
 * carry userinfo credentials or query-string tokens).
 */
class PluginUpdateUrlRejectedException extends RuntimeException
{
    public const REASON_UNPARSEABLE   = 'unparseable_url';
    public const REASON_BAD_SCHEME    = 'disallowed_scheme';
    public const REASON_PRIVATE_HOST  = 'private_host';
    public const REASON_NOT_ALLOWLIST = 'host_not_allowlisted';
    public const REASON_MISSING       = 'missing_update_url';

    public function __construct(string $message, public readonly string $reason)
    {
        parent::__construct($message);
    }

    public static function unparseableUrl(string $url): self
    {
        return new self(
            __('The plugin\'s update URL could not be parsed: :url', ['url' => $url]),
            self::REASON_UNPARSEABLE,
        );
    }

    public static function disallowedScheme(string $scheme, array $allowed): self
    {
        return new self(
            __('The plugin\'s update URL scheme ":scheme" is not allowed. Allowed schemes: :allowed.', [
                'scheme'  => '' === $scheme ? '(none)' : $scheme,
                'allowed' => implode(', ', $allowed),
            ]),
            self::REASON_BAD_SCHEME,
        );
    }

    public static function privateHost(string $host): self
    {
        return new self(
            __('The plugin\'s update URL points at a private, loopback, or link-local host (":host"), which is blocked. Set KEYSTONE_PLUGIN_UPDATE_URL_ALLOW_PRIVATE=true to override.', ['host' => $host]),
            self::REASON_PRIVATE_HOST,
        );
    }

    public static function hostNotAllowlisted(string $host): self
    {
        return new self(
            __('The plugin\'s update URL host ":host" is not in the configured allowlist.', ['host' => $host]),
            self::REASON_NOT_ALLOWLIST,
        );
    }

    public static function missingUpdateUrl(string $slug): self
    {
        return new self(
            __('Plugin ":slug" has no update_url in its manifest.', ['slug' => $slug]),
            self::REASON_MISSING,
        );
    }
}
