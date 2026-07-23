<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Exceptions\ThemeInstallException;
use App\Http\Controllers\Controller;
use App\Services\ThemeInstaller;
use App\Services\ThemeSeedApplier;
use ArtisanPackUI\CMSFramework\Modules\Themes\Exceptions\ThemeNotFoundException;
use ArtisanPackUI\CMSFramework\Modules\Themes\Managers\ThemeManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Admin-only theme management: list installed themes, upload + activate +
 * uninstall. Mounted under /admin/site-design/themes with the `role:admin`
 * gate per the install-gating decision in plans/08-themes-site-editor-arc.md.
 *
 * The cms-framework ThemeManager owns discovery + activation; ThemeInstaller
 * (Keystone) handles the zip extraction + on-disk placement step that the
 * package intentionally does not provide.
 */
class ThemeController extends Controller
{
    public function __construct(
        private ThemeManager $themeManager,
        private ThemeInstaller $installer,
        private ThemeSeedApplier $seedApplier,
    ) {}

    public function index(): Response
    {
        return Inertia::render('admin/site-design/Themes', [
            'themes' => $this->themesPayload(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'theme'     => ['required', 'file', 'mimetypes:application/zip,application/x-zip-compressed,application/octet-stream', 'max:51200'],
            'overwrite' => ['nullable', 'boolean'],
        ]);

        try {
            $result = $this->installer->install(
                $validated['theme'],
                (bool) ($validated['overwrite'] ?? false),
            );
        } catch (ThemeInstallException $e) {
            return back()->withErrors(['theme' => $e->getMessage()]);
        }

        return redirect()
            ->route('admin.site-design.themes.index')
            ->with('success', __('Theme ":name" installed.', ['name' => $result['manifest']['name'] ?? $result['slug']]));
    }

    public function activate(string $slug): RedirectResponse
    {
        try {
            $this->themeManager->activateTheme($slug);
        } catch (ThemeNotFoundException) {
            return back()->withErrors(['slug' => __('Theme ":slug" not found.', ['slug' => $slug])]);
        }

        // Seeding runs after activation succeeds. A throw here would
        // otherwise return a 500 even though the theme is already active —
        // surface a warning flash instead so the admin sees the partial-
        // success outcome rather than a generic error page.
        try {
            $this->seedApplier->apply($slug);
        } catch (Throwable $e) {
            report($e);

            return redirect()
                ->route('admin.site-design.themes.index')
                ->with('warning', __('Theme activated, but default content could not be seeded.'));
        }

        // TODO(#20): dispatch PurgeCloudflareCacheJob once that job lands.
        // For now we rely on ThemeManager::activateTheme to clear the
        // discovery cache + the view cache.

        return redirect()
            ->route('admin.site-design.themes.index')
            ->with('success', __('Theme activated.'));
    }

    public function destroy(string $slug): RedirectResponse
    {
        try {
            $this->installer->uninstall($slug);
        } catch (ThemeInstallException $e) {
            return back()->withErrors(['slug' => $e->getMessage()]);
        }

        return redirect()
            ->route('admin.site-design.themes.index')
            ->with('success', __('Theme removed.'));
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function themesPayload(): array
    {
        $themes = $this->themeManager->discoverThemes();

        return array_map(static fn (array $theme): array => [
            'slug'        => (string) ($theme['slug'] ?? ''),
            'name'        => (string) ($theme['name'] ?? ($theme['slug'] ?? '')),
            'version'     => (string) ($theme['version'] ?? ''),
            'description' => (string) ($theme['description'] ?? ''),
            'author'      => (string) ($theme['author'] ?? ''),
            'is_active'   => (bool) ($theme['is_active'] ?? false),
        ], $themes);
    }
}
