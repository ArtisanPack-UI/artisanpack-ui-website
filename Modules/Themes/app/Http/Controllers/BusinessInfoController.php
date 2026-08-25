<?php

declare(strict_types=1);

namespace Modules\Themes\Http\Controllers;

use App\Http\Controllers\Controller;
use ArtisanPackUI\CMSFramework\Modules\Settings\Managers\SettingsManager;
use ArtisanPackUI\CMSFramework\Modules\Settings\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Modules\Themes\Http\Requests\BusinessInfoRequest;

/**
 * Site Design > Business Info — the "create once, use everywhere"
 * surface (UX principle #4). Edits the `global.*` keys registered in
 * {@see \App\Providers\SettingsServiceProvider::registerGlobalContentSettings()}
 * so any page that reads `apGetSetting('global.phone')` (controllers,
 * Blade, Inertia props) sees the update immediately.
 *
 * Modeled on cms-framework's `SiteSettingController` — a thin façade
 * over `SettingsManager` with a small whitelist of keys.
 */
class BusinessInfoController extends Controller
{
    /**
     * Map of UI envelope keys → underlying `global.*` setting keys. Kept
     * as a single source of truth so the edit + update paths agree on
     * which fields the panel owns.
     *
     * @var array<string, string>
     */
    private const FIELD_MAP = [
        'business_name' => 'global.business_name',
        'phone'         => 'global.phone',
        'email'         => 'global.email',
        'address'       => 'global.address',
        'hours'         => 'global.hours',
        'social_links'  => 'global.social_links',
    ];

    public function __construct(private SettingsManager $settings) {}

    /**
     * Render the Business Info panel pre-filled with the current values.
     */
    public function edit(): Response
    {
        Gate::authorize('viewAny', Setting::class);

        return Inertia::render('admin/site-design/BusinessInfo', [
            'business_info' => $this->buildPayload(),
        ]);
    }

    /**
     * Persist a partial update. Only keys present in the validated
     * payload are written; absent keys keep their previous value, so the
     * UI can PATCH a single field without re-supplying the rest.
     */
    public function update(BusinessInfoRequest $request): RedirectResponse
    {
        Gate::authorize('update', Setting::class);

        $validated = $request->validated();
        $diff      = [];

        foreach (self::FIELD_MAP as $envelopeKey => $settingKey) {
            if (array_key_exists($envelopeKey, $validated)) {
                $previous = $this->settings->getSetting($settingKey);
                $next     = $validated[$envelopeKey];

                if ($previous !== $next) {
                    $diff[$envelopeKey] = ['from' => $previous, 'to' => $next];
                }

                $this->settings->updateSetting($settingKey, $next);

                // TODO(#20): dispatch PurgeCloudflareCacheJob(["global:{$envelopeKey}"])
                // once that job lands. Matches the deferred-dispatch pattern in
                // ThemeController::activate().
            }
        }

        doAction('keystone.admin.settings.businessInfo.saved', ['panel' => 'businessInfo', 'diff' => $diff]);
        doAction('keystone.admin.settings.saved', ['panel' => 'businessInfo', 'diff' => $diff]);

        return back()->with('success', __('Business info updated.'));
    }

    /**
     * Read every `global.*` key through `SettingsManager::getSetting()`
     * so registered defaults (full address shape, default hours, empty
     * social-links list) fill in before the host has saved anything.
     *
     * @return array<string, mixed>
     */
    private function buildPayload(): array
    {
        $payload = [];

        foreach (self::FIELD_MAP as $envelopeKey => $settingKey) {
            $payload[$envelopeKey] = $this->settings->getSetting($settingKey);
        }

        return $payload;
    }
}
