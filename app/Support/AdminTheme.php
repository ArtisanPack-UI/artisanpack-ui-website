<?php

declare(strict_types=1);

namespace App\Support;

use ArtisanPack\Accessibility\Core\WcagValidator;
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
 *
 * Each brand colour is emitted twice: the original key (`primaryColor`,
 * `secondaryColor`, `accentColor`) holds the value clamped for the LIGHT
 * theme's base surface, and a matching `*Dark` key holds the value clamped
 * for the DARK theme's base surface. Colours that already meet the target
 * WCAG contrast ratio pass through unchanged; colours that don't get their
 * HSL lightness nudged in the direction away from the surface until they do
 * (or until the L channel bottoms out). The client picks the right variant
 * based on the active scheme reported by the theme provider — the clamp
 * itself is server-side only so there's a single implementation of the
 * WCAG math.
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
     * Base `--color-base-100` surface for the keystone-light theme. Mirrors
     * `resources/css/app.css`.
     */
    private const LIGHT_BASE = '#ffffff';

    /**
     * Base `--color-base-100` surface for the keystone-dark theme. Mirrors
     * `resources/css/app.css`.
     */
    private const DARK_BASE = '#0f172a';

    /**
     * WCAG contrast floor for user-picked brand colours against the theme's
     * base surface. 3:1 is the AA minimum for graphical objects / UI
     * components — text contrast (4.5:1) is stricter than we want to enforce
     * on a brand-colour picker because it would visibly recolour vibrant
     * accents into muted tones without warning.
     */
    private const CONTRAST_TARGET = 3.0;

    /**
     * The admin palette + forced scheme for the Inertia shared props. Colours
     * are validated hex strings or null; `forceTheme` is always one of
     * {@see self::FORCE_THEME_VALUES}. Each brand colour is returned twice —
     * once clamped for the light base and once for the dark base — so the
     * client can pick per active theme.
     *
     * @return array{primaryColor: string|null, primaryColorDark: string|null, secondaryColor: string|null, secondaryColorDark: string|null, accentColor: string|null, accentColorDark: string|null, forceTheme: string}
     */
    public static function palette(): array
    {
        $settings = app(SettingsManager::class);
        $wcag     = app(WcagValidator::class);

        $primary   = self::hexColor($settings->getSetting('admin.primaryColor'));
        $secondary = self::hexColor($settings->getSetting('admin.secondaryColor'));
        $accent    = self::hexColor($settings->getSetting('admin.accentColor'));

        return [
            'primaryColor'       => self::clampForContrast($wcag, $primary, self::LIGHT_BASE),
            'primaryColorDark'   => self::clampForContrast($wcag, $primary, self::DARK_BASE),
            'secondaryColor'     => self::clampForContrast($wcag, $secondary, self::LIGHT_BASE),
            'secondaryColorDark' => self::clampForContrast($wcag, $secondary, self::DARK_BASE),
            'accentColor'        => self::clampForContrast($wcag, $accent, self::LIGHT_BASE),
            'accentColorDark'    => self::clampForContrast($wcag, $accent, self::DARK_BASE),
            'forceTheme'         => self::forceTheme($settings->getSetting('admin.forceTheme')),
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

    /**
     * Return `$hex` unchanged when it already meets the contrast target
     * against `$baseHex`; otherwise nudge HSL lightness in the direction away
     * from the base (darker on a light base, lighter on a dark base) until
     * the contrast ratio is met or the L channel bottoms out. Nulls pass
     * through so a missing/malformed stored colour keeps the theme default.
     *
     * WCAG luminance/contrast comes from the accessibility package's
     * {@see WcagValidator} — its `calculateContrastRatio()` is memoized by
     * sorted-pair key so the up-to-100 iterations in the loop don't
     * re-linearize the base surface every step.
     */
    private static function clampForContrast(WcagValidator $wcag, ?string $hex, string $baseHex): ?string
    {
        if (null === $hex) {
            return null;
        }

        if ($wcag->calculateContrastRatio($hex, $baseHex) >= self::CONTRAST_TARGET) {
            return $hex;
        }

        // Adjust in HSL space so hue + saturation stay intact — only the L
        // channel moves. Direction is set by the base's luminance: on a
        // light surface we darken (reduce L); on a dark surface we lighten.
        // Using the base's rough L (average of its channels normalized to
        // 0..1) is enough to pick a direction — the WCAG-accurate ratio is
        // still what governs the exit condition.
        [$h, $s, $l] = self::hexToHsl($hex);
        $step        = self::isLightSurface($baseHex) ? -0.01 : 0.01;

        for ($i = 0; $i < 100; $i++) {
            $l += $step;
            if ($l <= 0 || $l >= 1) {
                $l = max(0.0, min(1.0, $l));
                break;
            }
            $candidate = self::hslToHex($h, $s, $l);
            if ($wcag->calculateContrastRatio($candidate, $baseHex) >= self::CONTRAST_TARGET) {
                return $candidate;
            }
        }

        return self::hslToHex($h, $s, $l);
    }

    /**
     * Rough light/dark classification of a base surface — used only to pick
     * the clamp direction. The exit test is still WCAG contrast against the
     * exact hex, so this doesn't need to be precise.
     */
    private static function isLightSurface(string $hex): bool
    {
        [$r, $g, $b] = self::hexToRgb($hex);

        return ($r + $g + $b) / 3 > 127;
    }

    /**
     * Parse a `#rgb`, `#rrggbb`, or `#rrggbbaa` hex into an `[r, g, b]` tuple.
     * The alpha channel (if any) is discarded — the clamp treats colours as
     * opaque paint over the base surface.
     *
     * @return array{0: int, 1: int, 2: int}
     */
    private static function hexToRgb(string $hex): array
    {
        $hex = ltrim($hex, '#');

        if (3 === strlen($hex)) {
            $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
        }

        return [
            (int) hexdec(substr($hex, 0, 2)),
            (int) hexdec(substr($hex, 2, 2)),
            (int) hexdec(substr($hex, 4, 2)),
        ];
    }

    /**
     * Convert hex to HSL where h ∈ [0, 360), s and l ∈ [0, 1].
     *
     * @return array{0: float, 1: float, 2: float}
     */
    private static function hexToHsl(string $hex): array
    {
        [$r, $g, $b] = self::hexToRgb($hex);
        $rf          = $r / 255;
        $gf          = $g / 255;
        $bf          = $b / 255;

        $max = max($rf, $gf, $bf);
        $min = min($rf, $gf, $bf);
        $l   = ($max + $min) / 2;

        if ($max === $min) {
            return [0.0, 0.0, $l];
        }

        $d = $max - $min;
        $s = $l > 0.5 ? $d / (2 - $max - $min) : $d / ($max + $min);

        $h = match ($max) {
            $rf     => ($gf - $bf) / $d + ($gf < $bf ? 6 : 0),
            $gf     => ($bf - $rf) / $d + 2,
            default => ($rf - $gf) / $d + 4,
        };

        return [$h * 60, $s, $l];
    }

    /**
     * Convert HSL (h ∈ [0, 360), s and l ∈ [0, 1]) back to a 6-digit hex
     * string. No HSL round-trip exists in the accessibility package's public
     * API (`AccessibleColorGenerator::hslToHex` is protected), so this stays
     * local.
     */
    private static function hslToHex(float $h, float $s, float $l): string
    {
        if (0.0 === $s) {
            $v = (int) round($l * 255);

            return sprintf('#%02x%02x%02x', $v, $v, $v);
        }

        $q = $l < 0.5 ? $l * (1 + $s) : $l + $s - $l * $s;
        $p = 2 * $l - $q;
        $h = fmod($h, 360) / 360;
        if ($h < 0) {
            $h += 1;
        }

        $hueToRgb = static function (float $p, float $q, float $t): float {
            if ($t < 0) {
                $t += 1;
            }
            if ($t > 1) {
                $t -= 1;
            }
            if ($t < 1 / 6) {
                return $p + ($q - $p) * 6 * $t;
            }
            if ($t < 1 / 2) {
                return $q;
            }
            if ($t < 2 / 3) {
                return $p + ($q - $p) * (2 / 3 - $t) * 6;
            }

            return $p;
        };

        return sprintf(
            '#%02x%02x%02x',
            (int) round($hueToRgb($p, $q, $h + 1 / 3) * 255),
            (int) round($hueToRgb($p, $q, $h) * 255),
            (int) round($hueToRgb($p, $q, $h - 1 / 3) * 255),
        );
    }
}
