<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin\Settings;

use App\Http\Controllers\Controller;
use App\Support\DeferredConfigCacheRebuild;
use App\Support\EnvWriter;
use ArtisanPackUI\Privacy\Models\ConsentCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\DB;

/**
 * Settings → Privacy — configuration for the privacy package inside the
 * Keystone admin shell.
 *
 * The Livewire dashboard the package ships is intentionally *not* mounted
 * (see issue #96 architecture note): Keystone runs Inertia/React and its
 * own admin shell, so this controller talks to the package's models + env
 * directly. The Privacy tab is rendered inline inside `admin/Settings`
 * by {@see KeystoneShellController::settings()}, which calls
 * {@see self::payload()} to hydrate the panel; this controller owns the
 * mutation endpoints (update settings + CRUD on categories).
 *
 * Environment-driven fields (regulation toggles, emails, retention
 * windows) are persisted through {@see EnvWriter} — the same primitive the
 * install wizard uses. Consent categories are edited against the
 * `privacy_consent_categories` table via the {@see ConsentCategory} model.
 */
class PrivacyController extends Controller
{
    /**
     * Env keys the general form writes to. Kept in one place so the read
     * side of `show()` and the validated set of `update()` never drift.
     *
     * @var array<string, array{env: string, config: string, type: string}>
     */
    private const GENERAL_FIELDS = [
        'gdpr_enabled'    => ['env' => 'PRIVACY_GDPR_ENABLED',   'config' => 'artisanpack.privacy.regulations.gdpr.enabled',   'type' => 'bool'],
        'ccpa_enabled'    => ['env' => 'PRIVACY_CCPA_ENABLED',   'config' => 'artisanpack.privacy.regulations.ccpa.enabled',   'type' => 'bool'],
        'lgpd_enabled'    => ['env' => 'PRIVACY_LGPD_ENABLED',   'config' => 'artisanpack.privacy.regulations.lgpd.enabled',   'type' => 'bool'],
        'pipeda_enabled'  => ['env' => 'PRIVACY_PIPEDA_ENABLED', 'config' => 'artisanpack.privacy.regulations.pipeda.enabled', 'type' => 'bool'],
        'admin_email'     => ['env' => 'PRIVACY_ADMIN_EMAIL',    'config' => 'artisanpack.privacy.data_requests.admin_email', 'type' => 'string'],
        'dpo_name'        => ['env' => 'PRIVACY_BREACH_DPO_NAME',  'config' => 'artisanpack.privacy.breach.dpo.name',  'type' => 'string'],
        'dpo_email'       => ['env' => 'PRIVACY_BREACH_DPO_EMAIL', 'config' => 'artisanpack.privacy.breach.dpo.email', 'type' => 'string'],
        'dpo_phone'       => ['env' => 'PRIVACY_BREACH_DPO_PHONE', 'config' => 'artisanpack.privacy.breach.dpo.phone', 'type' => 'string'],
        'authority_email' => ['env' => 'PRIVACY_BREACH_AUTHORITY_EMAIL', 'config' => 'artisanpack.privacy.breach.authority_email', 'type' => 'string'],
        'retention_days'  => ['env' => 'PRIVACY_RETENTION_ACCOUNT_DAYS', 'config' => 'artisanpack.privacy.policy.retention_account_days', 'type' => 'int'],
    ];

    /**
     * Panel payload consumed by `admin/Settings` under `settings.privacy`.
     *
     * @return array{
     *     settings: array<string, mixed>,
     *     categories: list<array<string, mixed>>,
     *     stats: array{consent_rows: int, pending_dsr_requests: int, total_dsr_requests: int}
     * }
     */
    public static function payload(): array
    {
        $pending = (int) DB::table('privacy_data_requests')
            ->whereIn('status', ['pending', 'verified', 'processing'])
            ->count();
        $total = (int) DB::table('privacy_data_requests')->count();

        return [
            'settings'   => self::settingsPayload(),
            'categories' => ConsentCategory::query()->ordered()->get()->map(fn (ConsentCategory $category) => [
                'id'          => $category->id,
                'key'         => $category->key,
                'name'        => $category->name,
                'description' => $category->description,
                'required'    => (bool) $category->required,
                'active'      => (bool) $category->active,
                'sort_order'  => (int) $category->sort_order,
                'regulations' => $category->regulations ?? [],
            ])->all(),
            'stats' => [
                'consent_rows'         => (int) DB::table('privacy_consents')->count(),
                'pending_dsr_requests' => $pending,
                'total_dsr_requests'   => $total,
            ],
        ];
    }

    public function update(Request $request, EnvWriter $env): RedirectResponse
    {
        $validated = $request->validate([
            'gdpr_enabled'    => ['boolean'],
            'ccpa_enabled'    => ['boolean'],
            'lgpd_enabled'    => ['boolean'],
            'pipeda_enabled'  => ['boolean'],
            'admin_email'     => ['nullable', 'email:filter'],
            'dpo_name'        => ['nullable', 'string', 'max:120'],
            'dpo_email'       => ['nullable', 'email:filter'],
            'dpo_phone'       => ['nullable', 'string', 'max:60'],
            'authority_email' => ['nullable', 'email:filter'],
            'retention_days'  => ['nullable', 'integer', 'min:1', 'max:3650'],
        ]);

        $diff = [];

        foreach (self::GENERAL_FIELDS as $key => $meta) {
            if (! array_key_exists($key, $validated)) {
                continue;
            }

            $raw = $validated[$key];

            $value = match ($meta['type']) {
                'bool'   => (bool) $raw ? 'true' : 'false',
                'int'    => null === $raw ? '' : (string) (int) $raw,
                default  => null === $raw ? '' : (string) $raw,
            };

            $env->set($meta['env'], $value);

            $cfgValue = match ($meta['type']) {
                'bool'   => (bool) $raw,
                'int'    => null === $raw ? null : (int) $raw,
                default  => null === $raw || '' === $raw ? null : $raw,
            };

            $previous = config($meta['config']);

            if ($previous !== $cfgValue) {
                $diff[$key] = ['from' => $previous, 'to' => $cfgValue];
            }

            config()->set($meta['config'], $cfgValue);
        }

        // If the app is running against a cached config (production
        // deployments typically are), rebuild the cache so the .env
        // changes we just wrote survive the next boot. Delegated to
        // {@see DeferredConfigCacheRebuild} so the 200-800ms rebuild
        // happens AFTER the response is flushed and overlapping saves
        // are coalesced through a cache-driver mutex.
        if (App::configurationIsCached()) {
            DeferredConfigCacheRebuild::schedule();
        }

        // Per-panel first, then the generic aggregator — subscribers can
        // hook whichever granularity fits their use case.
        doAction('keystone.admin.settings.privacy.saved', ['panel' => 'privacy', 'diff' => $diff]);
        doAction('keystone.admin.settings.saved', ['panel' => 'privacy', 'diff' => $diff]);

        return back()->with('success', 'Privacy settings saved.');
    }

    public function storeCategory(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'key'         => ['required', 'string', 'max:60', 'regex:/^[a-z0-9_-]+$/', 'unique:privacy_consent_categories,key'],
            'name'        => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'required'    => ['boolean'],
            'active'      => ['boolean'],
            'sort_order'  => ['nullable', 'integer', 'min:0'],
        ]);

        ConsentCategory::create([
            'key'         => $validated['key'],
            'name'        => $validated['name'],
            'description' => $validated['description'] ?? null,
            'required'    => (bool) ($validated['required'] ?? false),
            'active'      => (bool) ($validated['active'] ?? true),
            'sort_order'  => (int) ($validated['sort_order'] ?? 0),
            'regulations' => [],
        ]);

        return back()->with('success', 'Consent category added.');
    }

    public function updateCategory(Request $request, ConsentCategory $category): RedirectResponse
    {
        $validated = $request->validate([
            'name'        => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'required'    => ['boolean'],
            'active'      => ['boolean'],
            'sort_order'  => ['nullable', 'integer', 'min:0'],
        ]);

        $category->fill([
            'name'        => $validated['name'],
            'description' => $validated['description'] ?? null,
            'required'    => (bool) ($validated['required'] ?? $category->required),
            'active'      => (bool) ($validated['active'] ?? $category->active),
            'sort_order'  => (int) ($validated['sort_order'] ?? $category->sort_order),
        ])->save();

        return back()->with('success', 'Consent category updated.');
    }

    public function destroyCategory(ConsentCategory $category): RedirectResponse
    {
        if ($category->required) {
            return back()->withErrors([
                'category' => 'Required consent categories cannot be deleted — mark them inactive instead.',
            ]);
        }

        $category->delete();

        return back()->with('success', 'Consent category removed.');
    }

    /**
     * Materialise the current effective settings for the Inertia panel.
     *
     * @return array<string, mixed>
     */
    private static function settingsPayload(): array
    {
        $payload = [];

        foreach (self::GENERAL_FIELDS as $key => $meta) {
            $value = config($meta['config']);

            $payload[$key] = match ($meta['type']) {
                'bool'   => (bool) $value,
                'int'    => null === $value ? null : (int) $value,
                default  => null === $value ? '' : (string) $value,
            };
        }

        return $payload;
    }
}
