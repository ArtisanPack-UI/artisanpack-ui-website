<?php

declare(strict_types=1);

namespace App\Providers;

use ArtisanPackUI\CMSFramework\Modules\Settings\Enums\SettingType;
use ArtisanPackUI\CMSFramework\Modules\Settings\Managers\SettingsManager;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\ServiceProvider;

/**
 * Registers Keystone's product-specific settings catalog with the
 * cms-framework `SettingsManager`.
 *
 * The framework owns the universal `site.*` keys (title, tagline, url,
 * logo/icon ids). Keystone owns the keys that describe *this* product:
 * admin brand colors, SEO defaults, notification toggles, and the API
 * surface. Each key registers its `SettingType` and a sanitizer so saves
 * routed through `PUT /api/v1/settings` (the manager-routed bulk endpoint)
 * are cleaned and typed consistently.
 *
 * The `general.*` group is an **interim** registration: those universal CMS
 * keys belong in cms-framework#138 (default universal catalog). Until that
 * ships, Keystone registers them here so the General panel is functional;
 * remove this group once #138 lands.
 */
class SettingsServiceProvider extends ServiceProvider
{
    /**
     * Bootstrap the Keystone settings catalog.
     */
    public function boot(SettingsManager $settings): void
    {
        $this->registerGeneralSettings($settings);
        $this->registerBrandSettings($settings);
        $this->registerSeoSettings($settings);
        $this->registerDiscussionSettings($settings);
        $this->registerPermalinkSettings($settings);
        $this->registerNotificationSettings($settings);
        $this->registerSecuritySettings($settings);
        $this->registerApiSettings($settings);
        $this->registerGlobalContentSettings($settings);

        $this->applyLocalization($settings);
        $this->applySiteName($settings);
    }

    /**
     * Use the configured site title (`site.title`) as the application name so
     * the document title and the shared `name` Inertia prop reflect the site
     * rather than the framework default ("Laravel"). Skipped when no title is
     * stored yet, preserving the `.env` fallback.
     */
    protected function applySiteName(SettingsManager $settings): void
    {
        $siteTitle = (string) $settings->getSetting('site.title');

        if ('' !== $siteTitle) {
            config(['app.name' => $siteTitle]);
        }
    }

    /**
     * Apply the General localization settings to the running app: set the
     * effective timezone (`config('app.timezone')` + PHP default) and the
     * app/Carbon locale from `general.timezone` / `general.locale`.
     *
     * Runs after registration so `getSetting()` can fall back to registered
     * defaults before the settings table is populated. Invalid timezone
     * identifiers are ignored so a bad stored value cannot break boot.
     */
    protected function applyLocalization(SettingsManager $settings): void
    {
        $timezone = (string) $settings->getSetting('general.timezone');

        if ('' !== $timezone && in_array($timezone, timezone_identifiers_list(), true)) {
            config(['app.timezone' => $timezone]);
            date_default_timezone_set($timezone);
        }

        $locale = (string) $settings->getSetting('general.locale');

        if ('' !== $locale) {
            App::setLocale($locale);
            Carbon::setLocale($locale);
        }
    }

    /**
     * Interim universal CMS keys consumed by the General panel. Slated to
     * move to cms-framework#138; site name/url/tagline stay on the
     * framework's `site.*` keys and are not duplicated here.
     */
    protected function registerGeneralSettings(SettingsManager $settings): void
    {
        $settings->registerSetting('general.timezone', 'UTC', 'sanitizeText', SettingType::String);
        $settings->registerSetting('general.locale', 'en', 'sanitizeText', SettingType::String);
        $settings->registerSetting('general.weekStart', 'sunday', 'sanitizeText', SettingType::String);
        $settings->registerSetting('general.dateFormat', 'F j, Y', 'sanitizeText', SettingType::String);
        $settings->registerSetting('general.timeFormat', 'g:i a', 'sanitizeText', SettingType::String);
        $settings->registerSetting('general.siteVisibility', 'public', 'sanitizeText', SettingType::String);
        $settings->registerSetting('general.sitePassword', '', $this->passwordSanitizer(), SettingType::String);
    }

    /**
     * Sanitizer for the site-access password. A blank value clears the
     * password (no gate). Any other value is hashed before storage so the
     * plaintext is never persisted; an already-hashed value is left intact
     * so re-saving unrelated settings cannot double-hash it.
     *
     * @return callable(mixed): string
     */
    protected function passwordSanitizer(): callable
    {
        return static function (mixed $value): string {
            $value = is_string($value) ? trim($value) : '';

            if ('' === $value) {
                return '';
            }

            if (Hash::isHashed($value)) {
                return $value;
            }

            return Hash::make($value);
        };
    }

    /**
     * Comment/discussion moderation. Interim universal keys (cms-framework#138).
     */
    protected function registerDiscussionSettings(SettingsManager $settings): void
    {
        $settings->registerSetting('discussion.comments', true, $this->booleanSanitizer(), SettingType::Boolean);
        $settings->registerSetting('discussion.commentsApproval', 'manually-approved', 'sanitizeText', SettingType::String);
        $settings->registerSetting('discussion.bannedWords', '', 'sanitizeText', SettingType::String);
        $settings->registerSetting('discussion.requireRegistration', true, $this->booleanSanitizer(), SettingType::Boolean);
        $settings->registerSetting('discussion.limitLinks', 0, 'sanitizeInt', SettingType::Integer);
        $settings->registerSetting('discussion.captcha', false, $this->booleanSanitizer(), SettingType::Boolean);
    }

    /**
     * Permalink structure. Interim universal key (cms-framework#138); stored
     * only — not yet wired to routing.
     */
    protected function registerPermalinkSettings(SettingsManager $settings): void
    {
        $settings->registerSetting('permalinks.structure', '/%post_name%/', 'sanitizeText', SettingType::String);
    }

    /**
     * Login hardening. Interim universal keys (cms-framework#138); stored only
     * — enforcement (lockout, forced 2FA) is wired separately. DSF's
     * route-defining login URL slugs are intentionally omitted.
     */
    protected function registerSecuritySettings(SettingsManager $settings): void
    {
        $settings->registerSetting('security.loginAttempts', 5, 'sanitizeInt', SettingType::Integer);
        $settings->registerSetting('security.loginTimeout', 120, 'sanitizeInt', SettingType::Integer);
        $settings->registerSetting('security.forceTwoFactor', false, $this->booleanSanitizer(), SettingType::Boolean);
    }

    /**
     * Admin brand customization. The logo itself is the framework's
     * `site.logo_id`; these keys cover the palette and theme override.
     */
    protected function registerBrandSettings(SettingsManager $settings): void
    {
        $settings->registerSetting('admin.primaryColor', '#0855b1', 'sanitizeText', SettingType::String);
        $settings->registerSetting('admin.secondaryColor', '#010e54', 'sanitizeText', SettingType::String);
        $settings->registerSetting('admin.accentColor', '#04d9ff', 'sanitizeText', SettingType::String);
        $settings->registerSetting('admin.forceTheme', 'system', 'sanitizeText', SettingType::String);
    }

    /**
     * SEO defaults applied when a page supplies no meta of its own.
     *
     * `titleSeparator` is what the SEO package puts between page title and
     * brand suffix (e.g. ` | `, ` — `, ` · `). `ogDefaultImageId` and
     * `twitterHandle` feed Open Graph / Twitter Card fallbacks. The schema
     * toggles let the site owner turn off Organization / Website JSON-LD
     * emission without uninstalling the package.
     */
    protected function registerSeoSettings(SettingsManager $settings): void
    {
        $settings->registerSetting('seo.defaultMetaTitle', '', 'sanitizeText', SettingType::String);
        $settings->registerSetting('seo.defaultMetaDescription', '', 'sanitizeText', SettingType::String);
        $settings->registerSetting('seo.noIndex', false, $this->booleanSanitizer(), SettingType::Boolean);
        $settings->registerSetting('seo.titleSeparator', ' | ', 'sanitizeText', SettingType::String);
        $settings->registerSetting('seo.ogDefaultImageId', 0, 'sanitizeInt', SettingType::Integer);
        $settings->registerSetting('seo.twitterHandle', '', 'sanitizeText', SettingType::String);
        $settings->registerSetting('seo.schemaOrganization', true, $this->booleanSanitizer(), SettingType::Boolean);
        $settings->registerSetting('seo.schemaWebsite', true, $this->booleanSanitizer(), SettingType::Boolean);
    }

    /**
     * Notification alert toggles surfaced on the Notifications panel.
     */
    protected function registerNotificationSettings(SettingsManager $settings): void
    {
        $settings->registerSetting('notifications.newOrders', true, $this->booleanSanitizer(), SettingType::Boolean);
        $settings->registerSetting('notifications.lowStock', true, $this->booleanSanitizer(), SettingType::Boolean);
        $settings->registerSetting('notifications.newLeads', true, $this->booleanSanitizer(), SettingType::Boolean);
        $settings->registerSetting('notifications.dailyDigest', false, $this->booleanSanitizer(), SettingType::Boolean);
        $settings->registerSetting('notifications.weeklyReport', true, $this->booleanSanitizer(), SettingType::Boolean);
    }

    /**
     * Developer/API surface. Webhooks and whether the public API is enabled.
     */
    protected function registerApiSettings(SettingsManager $settings): void
    {
        $settings->registerSetting('api.enabled', false, $this->booleanSanitizer(), SettingType::Boolean);
        $settings->registerSetting('api.webhookUrl', '', 'sanitizeUrl', SettingType::String);
    }

    /**
     * Global Content — the "create once, use everywhere" business-info
     * surface (UX principle #4). Keys are scoped under `global.*` so a
     * single read API (`apGetSetting('global.phone')`) works in any
     * controller, Blade template, or React page that needs them, and the
     * Site Design > Business Info panel writes to the exact same keys.
     *
     * `address`, `hours`, and `social_links` carry structured data so the
     * UI can render real fields (per-day hours, repeating social links)
     * rather than free-form text; the JSON cast on read preserves the
     * shape end-to-end.
     */
    protected function registerGlobalContentSettings(SettingsManager $settings): void
    {
        $settings->registerSetting('global.business_name', '', 'sanitizeText', SettingType::String);
        $settings->registerSetting('global.phone', '', 'sanitizeText', SettingType::String);
        $settings->registerSetting('global.email', '', 'sanitizeEmail', SettingType::String);
        $settings->registerSetting('global.address', $this->defaultGlobalAddress(), $this->globalAddressSanitizer(), SettingType::Json);
        $settings->registerSetting('global.hours', $this->defaultGlobalHours(), $this->globalHoursSanitizer(), SettingType::Json);
        $settings->registerSetting('global.social_links', [], $this->globalSocialLinksSanitizer(), SettingType::Json);
    }

    /**
     * Default address shape — keeps every field present so the React form
     * doesn't have to guard for missing keys on a fresh install.
     *
     * @return array{street: string, city: string, state: string, postal_code: string, country: string}
     */
    protected function defaultGlobalAddress(): array
    {
        return [
            'street'      => '',
            'city'        => '',
            'state'       => '',
            'postal_code' => '',
            'country'     => '',
        ];
    }

    /**
     * Default hours: Mon–Fri open, weekend closed. Each day carries a
     * `closed` flag so the UI can grey out the open/close inputs without
     * losing previously-entered times.
     *
     * @return array<string, array{open: string, close: string, closed: bool}>
     */
    protected function defaultGlobalHours(): array
    {
        $weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        $weekend  = ['saturday', 'sunday'];
        $hours    = [];

        foreach ($weekdays as $day) {
            $hours[$day] = ['open' => '09:00', 'close' => '17:00', 'closed' => false];
        }

        foreach ($weekend as $day) {
            $hours[$day] = ['open' => '', 'close' => '', 'closed' => true];
        }

        return $hours;
    }

    /**
     * Sanitize the address payload: coerce to a string for each known field
     * and drop everything else so a hostile client cannot smuggle extra
     * keys into the stored JSON.
     *
     * @return callable(mixed): array<string, string>
     */
    protected function globalAddressSanitizer(): callable
    {
        return function (mixed $value): array {
            $value = is_array($value) ? $value : [];
            $clean = $this->defaultGlobalAddress();

            foreach (array_keys($clean) as $field) {
                $clean[$field] = sanitizeText((string) ($value[$field] ?? ''));
            }

            return $clean;
        };
    }

    /**
     * Sanitize the per-day hours payload. Unknown days are dropped; each
     * known day always returns the full `{ open, close, closed }` shape so
     * downstream readers don't have to defensively `?? ''`.
     *
     * @return callable(mixed): array<string, array{open: string, close: string, closed: bool}>
     */
    protected function globalHoursSanitizer(): callable
    {
        return function (mixed $value): array {
            $value = is_array($value) ? $value : [];
            $days  = array_keys($this->defaultGlobalHours());
            $clean = [];

            foreach ($days as $day) {
                $entry         = is_array($value[$day] ?? null) ? $value[$day] : [];
                $clean[$day]   = [
                    'open'   => sanitizeText((string) ($entry['open'] ?? '')),
                    'close'  => sanitizeText((string) ($entry['close'] ?? '')),
                    'closed' => filter_var($entry['closed'] ?? false, FILTER_VALIDATE_BOOLEAN),
                ];
            }

            return $clean;
        };
    }

    /**
     * Sanitize the social-links list: each entry must carry a platform
     * label and a URL, both cleaned. Entries missing either field are
     * dropped so the stored value is always a renderable list.
     *
     * @return callable(mixed): list<array{platform: string, url: string}>
     */
    protected function globalSocialLinksSanitizer(): callable
    {
        return static function (mixed $value): array {
            if (! is_array($value)) {
                return [];
            }

            $clean = [];

            foreach ($value as $entry) {
                if (! is_array($entry)) {
                    continue;
                }

                $platform = sanitizeText((string) ($entry['platform'] ?? ''));
                $url      = sanitizeUrl((string) ($entry['url'] ?? ''));

                if ('' === $platform || '' === $url) {
                    continue;
                }

                $clean[] = ['platform' => $platform, 'url' => $url];
            }

            return $clean;
        };
    }

    /**
     * Sanitizer for boolean settings. The `artisanpack-ui/security` helper
     * set has no boolean cleaner, so coerce loosely-typed input (the string
     * "false", "0", etc. that arrive over JSON) the same way the
     * `SettingType::Boolean` cast does on read.
     *
     * @return callable(mixed): bool
     */
    protected function booleanSanitizer(): callable
    {
        return static fn (mixed $value): bool => filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }
}
