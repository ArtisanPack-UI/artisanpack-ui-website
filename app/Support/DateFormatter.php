<?php

declare(strict_types=1);

namespace App\Support;

use ArtisanPackUI\CMSFramework\Modules\Settings\Managers\SettingsManager;
use Carbon\CarbonInterface;
use Carbon\Exceptions\InvalidFormatException;
use DateTimeInterface;
use Illuminate\Support\Carbon;

/**
 * Formats user-facing dates and times using the General localization
 * settings (`general.dateFormat`, `general.timeFormat`, `general.timezone`,
 * `general.locale`).
 *
 * This is the server-side counterpart to
 * `resources/js/lib/admin/phpDateFormat.ts`: both read the same stored PHP
 * `date()` format strings so output is consistent across the API/SSR boundary.
 * Each value is converted into the configured site timezone and rendered with
 * `translatedFormat()` so the configured locale's month/day names apply.
 */
class DateFormatter
{
    public function __construct(private readonly SettingsManager $settings) {}

    /**
     * Format a date with the configured `general.dateFormat`.
     */
    public function date(DateTimeInterface|string|null $value): ?string
    {
        return $this->format($value, (string) $this->settings->getSetting('general.dateFormat'));
    }

    /**
     * Format a time with the configured `general.timeFormat`.
     */
    public function time(DateTimeInterface|string|null $value): ?string
    {
        return $this->format($value, (string) $this->settings->getSetting('general.timeFormat'));
    }

    /**
     * Format a combined date and time using both configured formats.
     */
    public function dateTime(DateTimeInterface|string|null $value): ?string
    {
        $date = $this->settings->getSetting('general.dateFormat');
        $time = $this->settings->getSetting('general.timeFormat');

        return $this->format($value, trim((string) $date.' '.(string) $time));
    }

    /**
     * Render the value in the configured timezone and locale with the given
     * PHP `date()` format string. Returns null for null/blank input so
     * callers can fall back to an em dash or empty state.
     */
    public function format(DateTimeInterface|string|null $value, string $format): ?string
    {
        if (null === $value || (is_string($value) && '' === trim($value))) {
            return null;
        }

        try {
            $carbon = $value instanceof CarbonInterface
                ? $value->copy()
                : Carbon::parse($value);
        } catch (InvalidFormatException) {
            return null;
        }

        $timezone = (string) $this->settings->getSetting('general.timezone');
        $locale   = (string) $this->settings->getSetting('general.locale');

        // Apply only a recognized identifier so a bad stored value can't throw
        // an InvalidTimeZoneException out of a display path.
        if ('' !== $timezone && in_array($timezone, timezone_identifiers_list(), true)) {
            $carbon = $carbon->setTimezone($timezone);
        }

        if ('' !== $locale) {
            $carbon = $carbon->locale($locale);
        }

        return $carbon->translatedFormat($format);
    }
}
