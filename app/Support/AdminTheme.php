<?php

declare(strict_types=1);

namespace App\Support;

use ArtisanPackUI\CMSFramework\Modules\Settings\Managers\SettingsManager;

/**
 * Resolves the admin brand palette (`admin.primaryColor`,
 * `admin.secondaryColor`, `admin.accentColor`) and the forced color scheme
 * (`admin.forceTheme`) into the shape the React admin shell consumes.
 *
 * The palette values override the daisyUI `keystone-light`/`keystone-dark`
 * theme tokens for the **admin chrome only** — the public site is themed by
 * the visual site editor and is unaffected by these settings. A stored colour
 * that isn't a valid CSS hex is dropped (returned as null) so the client keeps
 * the built-in theme default rather than applying a malformed override.
 */
class AdminTheme
{
    /**
     * Valid `admin.forceTheme` values. `system` preserves the per-user/browser
     * preference; `light`/`dark` pin the admin to that scheme.
     *
     * @var list<string>
     */
    private const FORCE_THEME_VALUES = ['system', 'light', 'dark'];

    /**
     * The admin palette + forced scheme for the Inertia shared props. Colours
     * are validated hex strings or null; `forceTheme` is always one of
     * {@see self::FORCE_THEME_VALUES}.
     *
     * @return array{primaryColor: string|null, secondaryColor: string|null, accentColor: string|null, forceTheme: string}
     */
    public static function palette(): array
    {
        $settings = app(SettingsManager::class);

        return [
            'primaryColor'   => self::hexColor($settings->getSetting('admin.primaryColor')),
            'secondaryColor' => self::hexColor($settings->getSetting('admin.secondaryColor')),
            'accentColor'    => self::hexColor($settings->getSetting('admin.accentColor')),
            'forceTheme'     => self::forceTheme($settings->getSetting('admin.forceTheme')),
        ];
    }

    /**
     * Normalise a stored colour to a valid 3-, 6-, or 8-digit CSS hex string,
     * or null when it is empty or malformed.
     */
    private static function hexColor(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        if (1 === preg_match('/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $value)) {
            return $value;
        }

        return null;
    }

    /**
     * Normalise the forced scheme, falling back to `system` for unknown values.
     */
    private static function forceTheme(mixed $value): string
    {
        if (is_string($value) && in_array($value, self::FORCE_THEME_VALUES, true)) {
            return $value;
        }

        return 'system';
    }
}
