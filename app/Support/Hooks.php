<?php

declare(strict_types=1);

namespace App\Support;

use Throwable;

/**
 * Hook naming for Keystone-owned hooks.
 *
 * Every Keystone hook name is a dot-delimited string that follows:
 *
 *     keystone.{surface}.{feature}.{event}
 *
 * where `{surface}` is one of `admin`, `public`, `auth`, `installer`,
 * `updater`, `cli`, `api`; each segment is lowerCamelCase; segments are
 * dot-delimited. Keystone-owned names always start with the `keystone.`
 * prefix, matching the vendor packages' `ap.{package}.*` convention.
 * See `docs/hooks.md` for the full write-up and the current reference
 * table of hooks Keystone emits.
 *
 * Renamed hooks must also be registered in {@see HookAliases} so
 * existing subscribers keep firing during the deprecation window.
 */
final class Hooks
{
    /**
     * Prefix shared by every Keystone-owned hook name. Kept as a
     * constant so a future rename of the root namespace is a
     * one-line change.
     */
    public const PREFIX = 'keystone.';

    /**
     * Fire an action hook with the guarantee that a throwing subscriber
     * cannot escape the emit site. The hooks package dispatches
     * callbacks directly with no exception isolation, so a plugin bug
     * would otherwise turn an already-persisted mutation into a 500 —
     * defeating the point of an observable extension seam. Reserved for
     * post-persistence emit sites where the state change is already
     * committed and the caller must return a successful response.
     * Reports the exception through {@see report()} so it still shows
     * up in error logs.
     */
    public static function safeDoAction(string $hook, mixed ...$args): void
    {
        try {
            doAction($hook, ...$args);
        } catch (Throwable $e) {
            report($e);
        }
    }
}
