<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Collects the module-contributed panels of `/admin/settings`.
 *
 * `/admin/settings` is one Inertia page whose `settings` prop hydrates every
 * tab in a single response. Most tabs are core panels read straight off
 * `SettingsManager`, but the env-driven ones (Privacy, Performance) belong to
 * modules. Core used to call those module controllers by name — `app/`
 * depending on `Modules/`, the reverse of every other direction in the
 * codebase, and the reason a module could never be made genuinely removable
 * (#235). Instead core emits a filter and each module registers its own panel
 * from its own service provider, mirroring how
 * {@see AdminMenu\AdminMenuBuilder} assembles the admin menu.
 *
 * ## Contract
 *
 * Filter: `keystone.admin.settings.panels`
 *
 *     addFilter(SettingsPanels::FILTER, function (array $panels): array {
 *         $panels['privacy'] ??= PrivacyController::payload();
 *
 *         return $panels;
 *     });
 *
 * Args: `(array<string, array<string, mixed>> $panels, array{surface: 'site'} $context)`.
 * Return the (possibly extended) map. A subscriber contributes one entry per
 * tab: the key is the tab key the React page reads (`settings.privacy`), the
 * value is that panel's payload array.
 *
 * ## Ordering and collisions
 *
 * Panels are appended after the core keys, in subscriber order (filter
 * priority, then registration order — i.e. module boot order for the two
 * built-in panels). The React page reads panels by key, never by position, so
 * the order is not load-bearing.
 *
 * Two rules resolve collisions, both enforced here rather than trusted to
 * subscribers:
 *
 *   1. **Core wins over modules.** A key that core already put in the payload
 *      is never overwritten by a subscriber — a plugin cannot replace the
 *      General or SEO panel through this seam.
 *   2. **First claim wins among modules.** Subscribers are asked to claim with
 *      `??=` so a second module claiming an already-claimed key is a no-op
 *      rather than a silent clobber of the first module's payload. A
 *      subscriber that ignores the convention and assigns unconditionally
 *      does overwrite the earlier claim — the filter chain hands it the array
 *      and cannot stop it; that is the documented escape hatch for a plugin
 *      deliberately replacing a module's panel.
 *
 * Anything that is not an `array` payload under a non-empty string key is
 * dropped, so a malformed subscriber costs one tab rather than the page.
 *
 * A module whose provider never runs simply never claims its key: the panel is
 * absent from the payload and the React page drops that tab (see the
 * `presentTabs` guard in `resources/js/pages/admin/Settings.tsx`). Missing tab,
 * not a 500.
 *
 * ## Authorization
 *
 * The emit site is the authorization boundary, not this class: panel payloads
 * carry admin-only configuration (the Privacy panel alone exposes the DPO and
 * breach-authority contacts plus DSR counts), and they are materialised only
 * because `settings()` already ran `Gate::authorize('viewAny', Setting::class)`.
 * A second emit site would need the same gate in front of it. Subscribers are
 * asked for a payload, never handed request input — the context argument is a
 * literal `['surface' => 'site']`.
 */
final class SettingsPanels
{
    /**
     * Filter emitted by {@see \App\Http\Controllers\Admin\KeystoneShellController::settings()}
     * to collect module-owned settings panels. Documented in `docs/hooks.md`.
     */
    public const FILTER = Hooks::PREFIX.'admin.settings.panels';

    /**
     * Merge the module-contributed panels into the core settings payload.
     *
     * @param  array<string, mixed>  $core  the core-owned panels, already keyed by tab
     *
     * @return array<string, mixed>
     */
    public static function merge(array $core): array
    {
        if (! function_exists('applyFilters')) {
            return $core;
        }

        /** @var mixed $registered */
        $registered = applyFilters(self::FILTER, [], ['surface' => 'site']);

        if (! is_array($registered)) {
            return $core;
        }

        foreach ($registered as $key => $payload) {
            if (! is_string($key) || '' === $key || ! is_array($payload)) {
                continue;
            }

            if (array_key_exists($key, $core)) {
                continue;
            }

            $core[$key] = $payload;
        }

        return $core;
    }
}
