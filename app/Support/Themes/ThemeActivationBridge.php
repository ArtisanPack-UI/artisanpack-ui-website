<?php

declare(strict_types=1);

namespace App\Support\Themes;

use App\Support\Hooks;
use ArtisanPackUI\CMSFramework\Modules\Themes\Managers\ThemeManager;
use Throwable;

/**
 * Bridges the vendor `ap.cmsFramework.theme.activating` /
 * `ap.cmsFramework.theme.activated` hooks to the surface-agnostic
 * `keystone.themes.activated` action so every theme switch — admin
 * controller, installer, CLI, programmatic — fires the same Keystone
 * event with `{previousSlug, newSlug}`.
 *
 * Vendor's `theme.activated` only carries the NEW slug. To hand
 * subscribers the previous slug too, we snapshot the current active
 * theme during the pre-switch `theme.activating` fire and read it
 * back inside the post-switch `theme.activated` handler.
 *
 * The static state is per-process; a request that never activates
 * a theme never touches it. Nested activations (a subscriber that
 * activates another theme from inside a theme.activated handler)
 * would clobber the snapshot — we accept that trade-off because
 * vendor's activation path is sequential and nested self-activation
 * isn't a supported flow.
 */
class ThemeActivationBridge
{
    /**
     * Slug of the previously-active theme captured during the vendor
     * `activating` fire. Null when no theme was active or between
     * activation runs.
     */
    private static ?string $previousSlug = null;

    /**
     * Snapshot the currently-active theme's slug before the vendor
     * `activateTheme()` mutates settings. Called from the
     * `ap.cmsFramework.theme.activating` listener wired in
     * `AppServiceProvider::boot()`.
     */
    public static function onActivating(ThemeManager $themeManager): void
    {
        try {
            $current = $themeManager->getActiveTheme();
        } catch (Throwable) {
            self::$previousSlug = null;

            return;
        }

        $slug               = is_array($current) ? (string) ($current['slug'] ?? '') : '';
        self::$previousSlug = '' === $slug ? null : $slug;
    }

    /**
     * Emit the surface-agnostic Keystone action with the snapshotted
     * previous slug + the freshly-activated slug. Called from the
     * `ap.cmsFramework.theme.activated` listener wired in
     * `AppServiceProvider::boot()`.
     *
     * Wrapped through `Hooks::safeDoAction` so a broken subscriber
     * cannot escape the vendor listener chain and 500 the caller
     * (admin request, installer run, CLI command).
     */
    public static function onActivated(string $newSlug): void
    {
        $previous           = self::$previousSlug;
        self::$previousSlug = null;

        Hooks::safeDoAction('keystone.themes.activated', [
            'previousSlug' => $previous,
            'newSlug'      => $newSlug,
        ]);
    }
}
