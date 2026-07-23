<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Exceptions\PluginUpdateUrlRejectedException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PluginUploadRequest;
use App\Services\Plugins\PluginUpdateUrlGuard;
use ArtisanPackUI\CMSFramework\Modules\Plugins\Exceptions\IncompatiblePluginException;
use ArtisanPackUI\CMSFramework\Modules\Plugins\Exceptions\PluginInstallationException;
use ArtisanPackUI\CMSFramework\Modules\Plugins\Exceptions\PluginNotFoundException;
use ArtisanPackUI\CMSFramework\Modules\Plugins\Exceptions\PluginUpdateException;
use ArtisanPackUI\CMSFramework\Modules\Plugins\Exceptions\PluginValidationException;
use ArtisanPackUI\CMSFramework\Modules\Plugins\Managers\PluginManager;
use ArtisanPackUI\CMSFramework\Modules\Plugins\Managers\UpdateManager;
use ArtisanPackUI\CMSFramework\Modules\Plugins\Models\Plugin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Admin-only plugin management: list installed plugins, upload +
 * activate + deactivate + update + uninstall. Mounted under
 * /admin/system/plugins with the `role:admin` gate.
 *
 * The cms-framework PluginManager owns install/activation/deactivation
 * and UpdateManager owns update checking + application. This controller
 * is a thin wrapper: it does not use the framework's /api/v1/plugins JSON
 * API (that path is `auth`-gated rather than admin-gated, mirroring the
 * decision already made for ThemeController).
 *
 * Update-check flow (#109): the index render reads only pre-computed
 * cache entries; it never triggers an outbound HTTP call. Admins
 * refresh the cache explicitly via POST /admin/system/plugins/check-updates.
 *
 * Update-URL guard (#110): every trigger point that would cause the
 * framework to fetch a plugin's manifest URL runs the URL through
 * PluginUpdateUrlGuard first so a manifest declaring `update_url` at
 * a private/loopback host is rejected before Guzzle sees it.
 */
class PluginController extends Controller
{
    public function __construct(
        private PluginManager $pluginManager,
        private UpdateManager $updateManager,
        private PluginUpdateUrlGuard $updateUrlGuard,
    ) {}

    public function index(): Response
    {
        return Inertia::render('admin/system/Plugins', [
            'plugins' => $this->pluginsPayload(),
        ]);
    }

    public function store(PluginUploadRequest $request): RedirectResponse
    {
        $upload = $request->file('plugin');

        // Framework's extractZip target is base_path('plugins'); ZipArchive::extractTo
        // fails silently if the directory doesn't exist on a fresh checkout.
        File::ensureDirectoryExists($this->pluginsBasePath());

        try {
            $plugin = $this->pluginManager->installFromZip($upload->getRealPath());
        } catch (PluginValidationException|PluginInstallationException $e) {
            return back()->withErrors(['plugin' => $e->getMessage()]);
        }

        return redirect()
            ->route('admin.system.plugins.index')
            ->with('success', __('Plugin ":name" installed.', ['name' => $plugin->name ?? $plugin->slug]));
    }

    public function activate(string $slug): RedirectResponse
    {
        try {
            $this->pluginManager->activate($slug);
        } catch (PluginNotFoundException|IncompatiblePluginException $e) {
            return back()->withErrors(['slug' => $e->getMessage()]);
        } catch (Throwable $e) {
            report($e);

            // Don't surface the framework exception message: it can include
            // file paths, SQL fragments, or other internal detail. The
            // report() call preserves the full stack for the operator.
            return back()->withErrors(['slug' => __('Failed to activate plugin.')]);
        }

        return redirect()
            ->route('admin.system.plugins.index')
            ->with('success', __('Plugin activated.'));
    }

    public function deactivate(string $slug): RedirectResponse
    {
        try {
            $this->pluginManager->deactivate($slug);
        } catch (PluginNotFoundException $e) {
            return back()->withErrors(['slug' => $e->getMessage()]);
        }

        return redirect()
            ->route('admin.system.plugins.index')
            ->with('success', __('Plugin deactivated.'));
    }

    public function update(string $slug): RedirectResponse
    {
        $plugin = Plugin::where('slug', $slug)->first();

        if (! $plugin) {
            return back()->withErrors(['slug' => __('Plugin ":slug" is not installed.', ['slug' => $slug])]);
        }

        try {
            $this->assertUpdateUrlAllowed($plugin);
        } catch (PluginUpdateUrlRejectedException $e) {
            return back()->withErrors(['slug' => $e->getMessage()]);
        }

        try {
            $applied = $this->updateManager->updatePlugin($slug);
        } catch (PluginUpdateException|IncompatiblePluginException $e) {
            return back()->withErrors(['slug' => $e->getMessage()]);
        } catch (Throwable $e) {
            report($e);

            return back()->withErrors(['slug' => __('Failed to update plugin.')]);
        }

        if (! $applied) {
            return back()->with('warning', __('No update available for this plugin.'));
        }

        return redirect()
            ->route('admin.system.plugins.index')
            ->with('success', __('Plugin updated.'));
    }

    /**
     * Explicit refresh of the per-plugin update cache. Runs the
     * framework's checkPluginUpdate() synchronously (fanning out HTTP
     * requests to each plugin's `update_url`) after filtering to only
     * plugins whose URL passes the SSRF guard. Fired from the admin UI
     * — never from the index render path (#109).
     */
    public function checkUpdates(): RedirectResponse
    {
        $all = Plugin::query()->get();

        if ($all->isEmpty()) {
            return back()->with('warning', __('No plugins are installed.'));
        }

        $checked = 0;
        $skipped = 0;
        $failed  = 0;

        foreach ($all as $plugin) {
            $updateUrl = is_array($plugin->meta) ? ($plugin->meta['update_url'] ?? null) : null;

            $reason = $this->updateUrlGuard->rejectionReason($updateUrl);
            if (null !== $reason) {
                $skipped++;
                // Log the slug + rejection-reason code only. The full
                // update_url can carry userinfo credentials or query
                // tokens; leaking it into application logs is exactly
                // the kind of exposure a secret-scanner would flag.
                logger()->info('Plugin skipped during check-updates: update_url rejected by guard.', [
                    'slug'   => $plugin->slug,
                    'reason' => $reason,
                ]);

                continue;
            }

            // The framework's checkPluginUpdate() wraps its fetch in
            // Cache::remember, so a warm cache entry short-circuits the
            // HTTP call. That's the right behavior for the index render
            // path — but this action is exactly the point where the
            // admin is asking for a fresh probe. Evict first so we
            // actually hit the network.
            Cache::forget("plugin.update.{$plugin->slug}");

            try {
                $this->updateManager->checkPluginUpdate($plugin->slug);
                $checked++;
            } catch (Throwable $e) {
                // A single misbehaving update endpoint must not break
                // the whole refresh — log and continue. Count the
                // failure separately so the flash reflects it instead
                // of silently blending into "checked".
                $failed++;
                report($e);
            }
        }

        return redirect()
            ->route('admin.system.plugins.index')
            ->with($this->checkUpdatesFlash($checked, $skipped, $failed));
    }

    public function destroy(string $slug): RedirectResponse
    {
        try {
            $this->pluginManager->delete($slug);
        } catch (PluginNotFoundException $e) {
            return back()->withErrors(['slug' => $e->getMessage()]);
        }

        return redirect()
            ->route('admin.system.plugins.index')
            ->with('success', __('Plugin removed.'));
    }

    /**
     * Compose the flash key/message for the check-updates redirect.
     * Splitting the branches out keeps the action body readable and
     * makes each outcome individually testable.
     *
     * @return array<string, string>
     */
    private function checkUpdatesFlash(int $checked, int $skipped, int $failed): array
    {
        if ($checked > 0) {
            $parts = [__('Checked :checked plugin(s) for updates.', ['checked' => $checked])];
            if ($skipped > 0) {
                $parts[] = __(':skipped skipped (rejected update URL).', ['skipped' => $skipped]);
            }
            if ($failed > 0) {
                $parts[] = __(':failed check(s) failed and were logged.', ['failed' => $failed]);
            }

            return ['success' => implode(' ', $parts)];
        }

        if ($failed > 0) {
            return ['error' => __('All :failed update check(s) failed. See the application log for details.', ['failed' => $failed])];
        }

        return ['warning' => __(':skipped plugin(s) had rejected update URLs and were skipped.', ['skipped' => $skipped])];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function pluginsPayload(): array
    {
        $plugins = $this->pluginManager->discoverPlugins();

        return array_map(function (array $plugin): array {
            $slug   = (string) ($plugin['slug'] ?? '');
            $update = $this->cachedUpdateFor($slug);

            return [
                'slug'              => $slug,
                'name'              => (string) ($plugin['name'] ?? $slug),
                'version'           => (string) ($plugin['version'] ?? ''),
                'description'       => (string) ($plugin['description'] ?? ''),
                'author'            => (string) ($plugin['author'] ?? ''),
                'is_active'         => (bool) ($plugin['is_active'] ?? false),
                'update_available'  => null !== $update,
                'available_version' => is_array($update) ? (string) ($update['version'] ?? '') : '',
            ];
        }, $plugins);
    }

    /**
     * Read the framework's per-plugin update cache directly. Never
     * triggers the underlying HTTP fetch (`UpdateManager::checkPluginUpdate`
     * uses `Cache::remember`, which would call the callback on miss —
     * that's exactly the render-path stall #109 is fixing).
     *
     * COUPLING: the cache key format `plugin.update.{slug}` mirrors the
     * one the framework's UpdateManager writes at
     * vendor/artisanpack-ui/cms-framework/src/Modules/Plugins/Managers/UpdateManager.php:59
     * — if it renames or namespaces that key, this read silently returns
     * null and the admin never sees update badges. Left as a private
     * coupling until the framework exposes a getCachedUpdate() helper.
     *
     * @return array<string, mixed>|null
     */
    private function cachedUpdateFor(string $slug): ?array
    {
        if ('' === $slug) {
            return null;
        }

        $value = Cache::get("plugin.update.{$slug}");

        return is_array($value) ? $value : null;
    }

    /**
     * @throws PluginUpdateUrlRejectedException
     */
    private function assertUpdateUrlAllowed(Plugin $plugin): void
    {
        $meta = is_array($plugin->meta) ? $plugin->meta : [];
        $url  = $meta['update_url'] ?? null;

        if (! is_string($url) || '' === $url) {
            throw PluginUpdateUrlRejectedException::missingUpdateUrl($plugin->slug);
        }

        $this->updateUrlGuard->assertAllowed($url);
    }

    private function pluginsBasePath(): string
    {
        return base_path((string) config('cms.plugins.directory', 'plugins'));
    }
}
