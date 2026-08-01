<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Backward-compatible hook alias registration for Keystone-owned hooks.
 *
 * Mirrors the pattern shipped by the cms-framework package (see
 * `vendor/artisanpack-ui/cms-framework/src/Support/HookAliases.php`).
 * When a Keystone hook name changes, add an entry to {@see map()} so
 * `deprecateHook()` wires the old name to the new one and existing
 * subscribers keep firing during the deprecation window.
 *
 * Called once from {@see \App\Providers\AppServiceProvider::boot()},
 * early enough that aliases are in place before any subscriber
 * registers a callback.
 */
final class HookAliases
{
    /**
     * Register every Keystone hook alias against the hooks package's
     * deprecation manager. A no-op when no aliases are currently
     * declared; kept wired so the first rename is a map-only change.
     */
    public static function register(): void
    {
        self::registerAll(self::map());
    }

    /**
     * Register a specific old-to-new alias map with the hooks package's
     * deprecation manager. Exposed so tests can exercise the wiring
     * with a fixture map without leaking test entries into {@see map()};
     * production callers should use {@see register()}.
     *
     * @param  array<string, string>  $map
     */
    public static function registerAll(array $map): void
    {
        if (! function_exists('deprecateHook')) {
            return;
        }

        foreach ($map as $old => $new) {
            deprecateHook($old, $new);
        }
    }

    /**
     * The full old-to-new hook rename map for Keystone-owned hooks.
     *
     * @return array<string, string>
     */
    public static function map(): array
    {
        return [];
    }
}
