<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Admin\Settings\PerformanceController;
use App\Http\Controllers\Admin\Settings\PrivacyController;
use App\Http\Controllers\Controller;
use App\Http\Middleware\HandleInertiaRequests;
use App\Services\KeystoneAnalytics;
use App\Support\KeystoneSampleData;
use App\Support\NotificationItemPayload;
use ArtisanPackUI\CMSFramework\Modules\Settings\Managers\SettingsManager;
use ArtisanPackUI\CMSFramework\Modules\Settings\Models\Setting;
use ArtisanPackUI\CMSFramework\Modules\Themes\Managers\ThemeManager;
use ArtisanPackUI\MediaLibrary\Models\Media;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Renders the Keystone admin shell pages with sample data.
 *
 * Each action returns an Inertia page from `resources/js/pages/admin/`. The
 * data here is a snapshot from the design app; once the real CMS models
 * land in Phase 3, individual actions will move to dedicated controllers
 * (Pages, Posts, Orders, etc.).
 */
class KeystoneShellController extends Controller
{
    public function products(): Response
    {
        return Inertia::render('admin/Products', [
            'products' => KeystoneSampleData::products(),
        ]);
    }

    public function orders(): Response
    {
        $breakdown  = collect(KeystoneSampleData::orderStatusBreakdown())->keyBy('label');
        $totalCount = $breakdown->sum('value');
        $refunded   = $breakdown->get('Refunded')['value'] ?? 0;
        $pending    = $breakdown->get('Pending')['value'] ?? 0;

        return Inertia::render('admin/Orders', [
            'recent_orders'          => KeystoneSampleData::recentOrders(),
            'order_status_breakdown' => $breakdown->values()->all(),
            'order_total_count'      => $totalCount,
            'pending_count'          => $pending,
            'avg_order_value'        => 154.5,
            'refund_rate'            => $totalCount > 0 ? round(($refunded / $totalCount) * 100, 1) : 0,
        ]);
    }

    public function customers(): Response
    {
        return Inertia::render('admin/Customers', [
            'customers' => KeystoneSampleData::customers(),
        ]);
    }

    public function siteDesign(ThemeManager $themeManager, HandleInertiaRequests $inertia): Response
    {
        $active = $themeManager->getActiveTheme();

        return Inertia::render('admin/SiteDesign', [
            'site'         => $inertia->siteMetadata(),
            'active_theme' => null === $active ? null : [
                'slug'        => (string) ($active['slug'] ?? ''),
                'name'        => (string) ($active['name'] ?? ($active['slug'] ?? '')),
                'version'     => (string) ($active['version'] ?? ''),
                'author'      => (string) ($active['author'] ?? ''),
                'description' => (string) ($active['description'] ?? ''),
            ],
        ]);
    }

    public function settings(SettingsManager $settings): Response
    {
        Gate::authorize('viewAny', Setting::class);

        $logoId = $settings->getSetting('site.logo_id');

        return Inertia::render('admin/Settings', [
            'settings' => [
                'general' => [
                    'siteName'        => $settings->getSetting('site.title'),
                    'siteUrl'         => $settings->getSetting('site.url'),
                    'description'     => $settings->getSetting('site.tagline'),
                    'timezone'        => $settings->getSetting('general.timezone'),
                    'locale'          => $settings->getSetting('general.locale'),
                    'weekStart'       => $settings->getSetting('general.weekStart'),
                    'dateFormat'      => $settings->getSetting('general.dateFormat'),
                    'timeFormat'      => $settings->getSetting('general.timeFormat'),
                    'visibility'      => $settings->getSetting('general.siteVisibility'),
                    'hasSitePassword' => '' !== (string) $settings->getSetting('general.sitePassword'),
                ],
                'brand' => [
                    'primaryColor'   => $settings->getSetting('admin.primaryColor'),
                    'secondaryColor' => $settings->getSetting('admin.secondaryColor'),
                    'accentColor'    => $settings->getSetting('admin.accentColor'),
                    'forceTheme'     => $settings->getSetting('admin.forceTheme'),
                    'logo'           => $this->resolveLogo($logoId),
                ],
                'seo' => [
                    'defaultMetaTitle'       => $settings->getSetting('seo.defaultMetaTitle'),
                    'defaultMetaDescription' => $settings->getSetting('seo.defaultMetaDescription'),
                    'noIndex'                => (bool) $settings->getSetting('seo.noIndex'),
                    'titleSeparator'         => $settings->getSetting('seo.titleSeparator'),
                    'ogDefaultImageId'       => (int) $settings->getSetting('seo.ogDefaultImageId'),
                    'twitterHandle'          => $settings->getSetting('seo.twitterHandle'),
                    'schemaOrganization'     => (bool) $settings->getSetting('seo.schemaOrganization'),
                    'schemaWebsite'          => (bool) $settings->getSetting('seo.schemaWebsite'),
                ],
                'discussion' => [
                    'comments'            => (bool) $settings->getSetting('discussion.comments'),
                    'commentsApproval'    => $settings->getSetting('discussion.commentsApproval'),
                    'bannedWords'         => $settings->getSetting('discussion.bannedWords'),
                    'requireRegistration' => (bool) $settings->getSetting('discussion.requireRegistration'),
                    'limitLinks'          => (int) $settings->getSetting('discussion.limitLinks'),
                    'captcha'             => (bool) $settings->getSetting('discussion.captcha'),
                ],
                'permalinks' => [
                    'structure' => $settings->getSetting('permalinks.structure'),
                ],
                'security' => [
                    'loginAttempts'  => (int) $settings->getSetting('security.loginAttempts'),
                    'loginTimeout'   => (int) $settings->getSetting('security.loginTimeout'),
                    'forceTwoFactor' => (bool) $settings->getSetting('security.forceTwoFactor'),
                ],
                'notifications' => [
                    'newOrders'    => (bool) $settings->getSetting('notifications.newOrders'),
                    'lowStock'     => (bool) $settings->getSetting('notifications.lowStock'),
                    'newLeads'     => (bool) $settings->getSetting('notifications.newLeads'),
                    'dailyDigest'  => (bool) $settings->getSetting('notifications.dailyDigest'),
                    'weeklyReport' => (bool) $settings->getSetting('notifications.weeklyReport'),
                ],
                'developers' => [
                    'apiEnabled' => (bool) $settings->getSetting('api.enabled'),
                    'webhookUrl' => $settings->getSetting('api.webhookUrl'),
                ],
                // Privacy is env-driven (regulations, DPO contact,
                // retention window) plus a Consent Category table; the
                // dedicated PrivacyController owns the mutation
                // endpoints, but the read-side payload lives with the
                // rest of the Settings shell so a single Inertia
                // response hydrates every tab.
                'privacy' => PrivacyController::payload(),
                // Performance mirrors the same pattern — env-driven
                // feature toggles and tuning fields; the dedicated
                // PerformanceController owns the mutation endpoint and
                // exposes the read-side shape here.
                'performance' => PerformanceController::payload(),
            ],
            'options' => [
                'timezones'   => $this->timezoneOptions(),
                'locales'     => $this->localeOptions(),
                'weekDays'    => $this->weekDayOptions(),
                'dateFormats' => $this->dateFormatOptions(),
                'timeFormats' => $this->timeFormatOptions(),
            ],
        ]);
    }

    public function integrations(): Response
    {
        return Inertia::render('admin/Integrations', [
            'integrations' => KeystoneSampleData::integrations(),
        ]);
    }

    /**
     * Render the Reports page with live data from `artisanpack-ui/analytics`.
     *
     * The `revenue_series` prop stays sample-backed until the commerce
     * wiring lands in issue #28 — revenue is not an analytics metric.
     * KPIs, top pages, and traffic sources all flow through
     * {@see KeystoneAnalytics}, which already returns empty/zero shapes
     * when no data exists so the React page never has to special-case it.
     */
    public function reports(KeystoneAnalytics $analytics): Response
    {
        return Inertia::render('admin/Reports', [
            'kpis'            => $analytics->reportKpis(),
            'revenue_series'  => KeystoneSampleData::revenueSeries(),
            'top_pages'       => $analytics->topPages(),
            'traffic_sources' => $analytics->trafficSources(),
        ]);
    }

    public function activityLog(): Response
    {
        return Inertia::render('admin/ActivityLog', [
            'activity_log' => KeystoneSampleData::activityLog(),
        ]);
    }

    /**
     * Render the `/admin/notifications` page. The shared `keystone.notifications`
     * prop is capped at 10 so the bell dropdown stays small; this page needs
     * the full list so filters, grouping, and totals are accurate, so a
     * page-scoped `notifications` prop is passed alongside the shared one.
     */
    public function notifications(Request $request): Response
    {
        return Inertia::render('admin/Notifications', [
            'notifications' => NotificationItemPayload::forUser($request->user(), limit: 100),
        ]);
    }

    /**
     * Resolve a stored `site.logo_id` to the slim media record the brand
     * panel needs to preview the current logo. Returns null when no logo is
     * set or the referenced media no longer exists.
     *
     * @return array{id: int, url: string}|null
     */
    private function resolveLogo(mixed $logoId): ?array
    {
        if (empty($logoId)) {
            return null;
        }

        $media = Media::find((int) $logoId);

        if (null === $media) {
            return null;
        }

        return [
            'id'  => $media->id,
            'url' => $media->url,
        ];
    }

    /**
     * Real timezone identifiers for the General panel select.
     *
     * @return list<string>
     */
    private function timezoneOptions(): array
    {
        return timezone_identifiers_list();
    }

    /**
     * Common locale options. A curated set rather than the full ICU list so
     * the select stays usable; extend as Keystone gains translations.
     *
     * @return list<array{value: string, label: string}>
     */
    private function localeOptions(): array
    {
        return [
            ['value' => 'en', 'label' => 'English (US)'],
            ['value' => 'en_GB', 'label' => 'English (UK)'],
            ['value' => 'fr', 'label' => 'Français'],
            ['value' => 'es', 'label' => 'Español'],
            ['value' => 'de', 'label' => 'Deutsch'],
        ];
    }

    /**
     * Days of the week for the "week starts on" select.
     *
     * @return list<array{value: string, label: string}>
     */
    private function weekDayOptions(): array
    {
        return collect(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])
            ->map(fn (string $day): array => ['value' => $day, 'label' => ucfirst($day)])
            ->all();
    }

    /**
     * Predefined date-format presets with a live example rendered server-side
     * so the select shows what each token produces.
     *
     * @return list<array{key: string, label: string}>
     */
    private function dateFormatOptions(): array
    {
        $now = Carbon::now();

        return collect(['F j, Y', 'Y-m-d', 'm/d/Y', 'd/m/Y'])
            ->map(fn (string $format): array => ['key' => $format, 'label' => $now->translatedFormat($format)])
            ->all();
    }

    /**
     * Predefined time-format presets with a live example.
     *
     * @return list<array{key: string, label: string}>
     */
    private function timeFormatOptions(): array
    {
        $now = Carbon::now();

        return collect(['g:i a', 'g:i A', 'H:i'])
            ->map(fn (string $format): array => ['key' => $format, 'label' => $now->translatedFormat($format)])
            ->all();
    }
}
