<?php

declare(strict_types=1);

namespace Modules\Performance\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Support\DeferredConfigCacheRebuild;
use App\Support\EnvWriter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;

/**
 * Settings → Performance — configuration for the performance package
 * inside the Keystone admin shell.
 *
 * The Livewire dashboard the perf package ships is intentionally not
 * mounted (same architecture note as Privacy in issue #96): Keystone
 * runs Inertia/React and its own admin shell, so this controller reads
 * config and writes back to `.env` through {@see EnvWriter}. The
 * Performance tab is rendered inline inside `admin/Settings`;
 * {@see \Modules\Performance\Providers\PerformanceServiceProvider} claims
 * that tab on the `keystone.admin.settings.panels` filter and hydrates it
 * from {@see self::payload()}, so core never names this class. This
 * controller owns the mutation endpoint.
 *
 * Every field is env-backed so a config-cache rebuild survives the
 * write, and every write toggles the config value in-process so the
 * back-to-settings redirect sees the new state.
 */
class PerformanceController extends Controller
{
    /**
     * Env keys the settings form writes to. Kept in one place so the
     * read side of `payload()` and the validated set of `update()`
     * never drift.
     *
     * @var array<string, array{env: string, config: string, type: string}>
     */
    private const FIELDS = [
        // Feature toggles — mirror the vendor `features.*` block.
        'image_optimization'  => ['env' => 'PERF_IMAGE_OPTIMIZATION',  'config' => 'artisanpack.performance.features.image_optimization',  'type' => 'bool'],
        'page_cache'          => ['env' => 'PERF_PAGE_CACHE',          'config' => 'artisanpack.performance.features.page_cache',          'type' => 'bool'],
        'fragment_cache'      => ['env' => 'PERF_FRAGMENT_CACHE',      'config' => 'artisanpack.performance.features.fragment_cache',      'type' => 'bool'],
        'monitoring'          => ['env' => 'PERF_MONITORING',          'config' => 'artisanpack.performance.features.monitoring',          'type' => 'bool'],
        'speculative_loading' => ['env' => 'PERF_SPECULATIVE_LOADING', 'config' => 'artisanpack.performance.features.speculative_loading', 'type' => 'bool'],
        'resource_hints'      => ['env' => 'PERF_RESOURCE_HINTS',      'config' => 'artisanpack.performance.features.resource_hints',      'type' => 'bool'],
        'early_hints'         => ['env' => 'PERF_EARLY_HINTS',         'config' => 'artisanpack.performance.features.early_hints',         'type' => 'bool'],
        'html_minification'   => ['env' => 'PERF_HTML_MINIFICATION',   'config' => 'artisanpack.performance.features.html_minification',   'type' => 'bool'],
        'query_optimization'  => ['env' => 'PERF_QUERY_OPTIMIZATION',  'config' => 'artisanpack.performance.features.query_optimization',  'type' => 'bool'],
        // Tuning fields.
        'image_driver'        => ['env' => 'PERF_IMAGE_DRIVER',        'config' => 'artisanpack.performance.images.driver',                'type' => 'string'],
    ];

    /**
     * Panel payload consumed by `admin/Settings` under `settings.performance`.
     *
     * @return array{
     *     settings: array<string, mixed>,
     *     defaults: array{sampling_rate: int, page_cache_ttl: int, fragment_cache_ttl: int},
     *     drivers: list<array{value: string, label: string}>
     * }
     */
    public static function payload(): array
    {
        return [
            'settings' => self::settingsPayload(),
            'defaults' => [
                'sampling_rate'      => (int) config('artisanpack.performance.monitoring.sample_rate', 100),
                'page_cache_ttl'     => (int) config('artisanpack.performance.page_cache.ttl', 3600),
                'fragment_cache_ttl' => (int) config('artisanpack.performance.fragment_cache.default_ttl', 3600),
            ],
            'drivers' => [
                ['value' => 'gd',      'label' => 'GD (bundled with PHP)'],
                ['value' => 'imagick', 'label' => 'Imagick (ext-imagick)'],
            ],
        ];
    }

    public function update(Request $request, EnvWriter $env): RedirectResponse
    {
        // Coerce empty-string `image_driver` to null BEFORE validation
        // — but only when the field is actually present on the request.
        // The React panel initialises the field from the payload's
        // string default (which is '' when `PERF_IMAGE_DRIVER` isn't
        // set), and a POST with `image_driver=''` would otherwise fail
        // `in:gd,imagick` on the first save of a default install.
        //
        // Guarding on `has()` matters because the FIELDS loop below
        // only writes to `.env` when the key is present in the
        // validated payload. If a partial POST omits `image_driver`
        // entirely, an unconditional `merge([...])` would materialise
        // it as `null`, which would then clobber `PERF_IMAGE_DRIVER`
        // instead of leaving it unchanged.
        if ($request->has('image_driver')) {
            $request->merge([
                'image_driver' => '' === (string) $request->input('image_driver')
                    ? null
                    : $request->input('image_driver'),
            ]);
        }

        $validated = $request->validate([
            'image_optimization'  => ['boolean'],
            'page_cache'          => ['boolean'],
            'fragment_cache'      => ['boolean'],
            'monitoring'          => ['boolean'],
            'speculative_loading' => ['boolean'],
            'resource_hints'      => ['boolean'],
            'early_hints'         => ['boolean'],
            'html_minification'   => ['boolean'],
            'query_optimization'  => ['boolean'],
            'image_driver'        => ['nullable', 'in:gd,imagick'],
        ]);

        $diff = [];

        foreach (self::FIELDS as $key => $meta) {
            if (! array_key_exists($key, $validated)) {
                continue;
            }

            $raw = $validated[$key];

            $value = match ($meta['type']) {
                'bool'  => (bool) $raw ? 'true' : 'false',
                default => null === $raw ? '' : (string) $raw,
            };

            $env->set($meta['env'], $value);

            $cfgValue = match ($meta['type']) {
                'bool'  => (bool) $raw,
                default => null === $raw || '' === $raw ? null : $raw,
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
        // are coalesced through a cache-driver mutex — Laravel's
        // ConfigCacheCommand writes `bootstrap/cache/config.php`
        // without `LOCK_EX`, so two racing terminators can otherwise
        // corrupt the cache file.
        if (App::configurationIsCached()) {
            DeferredConfigCacheRebuild::schedule();
        }

        doAction('keystone.admin.settings.performance.saved', ['panel' => 'performance', 'diff' => $diff]);
        doAction('keystone.admin.settings.saved', ['panel' => 'performance', 'diff' => $diff]);

        return back()->with('success', 'Performance settings saved.');
    }

    /**
     * Materialise the current effective settings for the Inertia panel.
     *
     * @return array<string, mixed>
     */
    private static function settingsPayload(): array
    {
        $payload = [];

        foreach (self::FIELDS as $key => $meta) {
            $value = config($meta['config']);

            $payload[$key] = match ($meta['type']) {
                'bool'  => (bool) $value,
                default => null === $value ? '' : (string) $value,
            };
        }

        return $payload;
    }
}
