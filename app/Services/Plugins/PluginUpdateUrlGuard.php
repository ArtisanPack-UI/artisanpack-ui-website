<?php

declare(strict_types=1);

namespace App\Services\Plugins;

use App\Exceptions\PluginUpdateUrlRejectedException;

/**
 * Pre-flight validator for a plugin's manifest-declared `update_url`
 * before Keystone triggers the framework's update-check or update
 * dispatch. Blocks the trivial SSRF path (an update_url pointing at
 * 169.254.169.254 or a local admin) at the Keystone controller layer.
 *
 * Scope caveat: this validates only the manifest URL. The framework's
 * follow-on fetch of `download_url` (read from the update endpoint's
 * response body) is NOT guarded here — that has to be hardened
 * upstream in the framework's UpdateManager. See issue #110.
 *
 * Rules:
 *   - Scheme must be in the configured allowlist (default: `https`).
 *   - Host must not be a loopback, link-local, or RFC1918/RFC4193
 *     private address, unless `allow_private_hosts` is true.
 *   - "localhost" (and any host resolving obviously to it) is blocked
 *     as a private host.
 *   - If `allowed_hosts` is non-empty, host must be in that exact list.
 */
class PluginUpdateUrlGuard
{
    /**
     * @param  array<int, string>  $allowedSchemes
     * @param  array<int, string>  $allowedHosts  Empty = no host allowlist beyond the private-host check.
     */
    public function __construct(
        private readonly array $allowedSchemes,
        private readonly bool $allowPrivateHosts,
        private readonly array $allowedHosts,
    ) {}

    public static function fromConfig(): self
    {
        $schemes = config('keystone.plugins.update_url_guard.allowed_schemes', ['https']);
        $hosts   = config('keystone.plugins.update_url_guard.allowed_hosts', []);

        return new self(
            allowedSchemes: array_values(array_filter(array_map('strtolower', is_array($schemes) ? $schemes : ['https']))),
            allowPrivateHosts: (bool) config('keystone.plugins.update_url_guard.allow_private_hosts', false),
            allowedHosts: array_values(array_filter(array_map('strtolower', is_array($hosts) ? $hosts : []))),
        );
    }

    public function isAllowed(?string $url): bool
    {
        return null === $this->rejectionReason($url);
    }

    /**
     * Return the stable rejection-reason code for `$url`, or null if the
     * URL passes. Callers that need to log or branch on the category
     * (rather than surface the message) should use this to avoid
     * logging the full URL — it may contain userinfo or query tokens.
     */
    public function rejectionReason(?string $url): ?string
    {
        try {
            $this->assertAllowed((string) $url);
        } catch (PluginUpdateUrlRejectedException $e) {
            return $e->reason;
        }

        return null;
    }

    /**
     * @throws PluginUpdateUrlRejectedException
     */
    public function assertAllowed(string $url): void
    {
        $trimmed = trim($url);

        if ('' === $trimmed) {
            throw PluginUpdateUrlRejectedException::unparseableUrl($url);
        }

        $parts = parse_url($trimmed);

        if (false === $parts || ! is_array($parts)) {
            throw PluginUpdateUrlRejectedException::unparseableUrl($url);
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host   = strtolower((string) ($parts['host'] ?? ''));

        if ('' === $host) {
            throw PluginUpdateUrlRejectedException::unparseableUrl($url);
        }

        if (! in_array($scheme, $this->allowedSchemes, true)) {
            throw PluginUpdateUrlRejectedException::disallowedScheme($scheme, $this->allowedSchemes);
        }

        // Classify the host into one of {dns-name, ipv4, ipv6}. Anything
        // that isn't one of those exact shapes — decimal IP `2130706433`,
        // hex `0x7f000001`, octal `0177.0.0.1`, short form `127.1` — is
        // rejected here. curl accepts those and resolves them to
        // loopback/link-local, which is exactly what the private-host
        // check is trying to prevent.
        $classified = $this->classifyHost($host);

        if (null === $classified) {
            throw PluginUpdateUrlRejectedException::unparseableUrl($url);
        }

        if (! $this->allowPrivateHosts && $this->isPrivateHost($classified)) {
            throw PluginUpdateUrlRejectedException::privateHost($host);
        }

        if ([] !== $this->allowedHosts && ! in_array($host, $this->allowedHosts, true)) {
            throw PluginUpdateUrlRejectedException::hostNotAllowlisted($host);
        }
    }

    /**
     * Reduce `$host` to a canonical, unambiguous representation, or return
     * null if it's not a shape we're willing to reason about.
     *
     * Accepted shapes:
     *   - Dotted-quad IPv4 (four decimal octets)
     *   - IPv6 literal wrapped in `[...]`; IPv4-mapped IPv6 (`::ffff:a.b.c.d`)
     *     is unwrapped to its embedded IPv4 so private-range checks apply
     *     to the actual on-the-wire address
     *   - RFC1123-ish DNS name: labels of 1-63 chars, letters/digits/
     *     hyphens (no leading/trailing hyphen), dots between labels
     *
     * Everything else — non-standard IP encodings, control chars, empty
     * labels — is rejected as unparseable.
     *
     * @return array{kind: 'dns'|'ipv4'|'ipv6', value: string}|null
     */
    private function classifyHost(string $host): ?array
    {
        // Bracketed IPv6 — parse_url preserves the brackets on the host.
        if (str_starts_with($host, '[') && str_ends_with($host, ']')) {
            $inner = substr($host, 1, -1);

            // IPv4-mapped IPv6 (`::ffff:169.254.169.254`) → unwrap so the
            // private-range check runs against the real IPv4 destination.
            if (1 === preg_match('/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i', $inner, $m)) {
                if (false !== filter_var($m[1], FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                    return ['kind' => 'ipv4', 'value' => $m[1]];
                }

                return null;
            }

            if (false !== filter_var($inner, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
                return ['kind' => 'ipv6', 'value' => $inner];
            }

            return null;
        }

        // Strict dotted-quad IPv4: four decimal groups, each 0–255.
        // filter_var(FILTER_FLAG_IPV4) rejects octal/hex/decimal/short
        // forms — a bare-`127.1` returns false here, which is what we
        // want. The extra regex is belt-and-suspenders against future
        // filter_var leniency changes.
        if (1 === preg_match('/^(?:\d{1,3}\.){3}\d{1,3}$/', $host)
            && false !== filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            return ['kind' => 'ipv4', 'value' => $host];
        }

        // DNS name — labels, dots, no leading/trailing hyphens per label.
        // Additionally require at least one dot (rules out bare `2130706433`
        // and `0x7f000001` which curl would happily decode as IPs) and
        // require the last label to contain at least one letter (rules out
        // dotted-but-all-numeric encodings like `127.1`, `0177.0.0.1`,
        // `0300.0250.0001.0001` — which passed the earlier IPv4 regex only
        // because it was too permissive). No real TLD is all-digits.
        if (1 === preg_match(
            '/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/i',
            $host,
        )) {
            $labels    = explode('.', $host);
            $lastLabel = end($labels);
            if (1 === preg_match('/[a-z]/i', $lastLabel)) {
                return ['kind' => 'dns', 'value' => $host];
            }
        }

        return null;
    }

    /**
     * A host is private when it is a loopback/private/link-local IP or a
     * DNS name whose right-hand labels are commonly resolved to a local
     * host by the OS resolver (`localhost`, `*.localhost`, `*.local`).
     *
     * DNS resolution is intentionally NOT performed here — a public
     * hostname that resolves to a private IP still passes this check.
     * That's a limitation of pre-flight guarding; the deeper fix
     * belongs in the fetch layer (framework Http client), tracked
     * upstream. See issue #110.
     *
     * @param  array{kind: 'dns'|'ipv4'|'ipv6', value: string}  $classified
     */
    private function isPrivateHost(array $classified): bool
    {
        return match ($classified['kind']) {
            'ipv4' => ! filter_var(
                $classified['value'],
                FILTER_VALIDATE_IP,
                FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
            ),
            'ipv6' => ! filter_var(
                $classified['value'],
                FILTER_VALIDATE_IP,
                FILTER_FLAG_IPV6 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
            ),
            'dns'  => 'localhost' === $classified['value']
                || str_ends_with($classified['value'], '.localhost')
                || str_ends_with($classified['value'], '.local'),
        };
    }
}
