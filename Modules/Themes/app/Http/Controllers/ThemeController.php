<?php

declare(strict_types=1);

namespace Modules\Themes\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Support\Hooks;
use ArtisanPackUI\CMSFramework\Modules\Themes\Exceptions\ThemeNotFoundException;
use ArtisanPackUI\CMSFramework\Modules\Themes\Managers\ThemeManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Modules\Themes\Exceptions\ThemeInstallException;
use Modules\Themes\Services\ThemeInstaller;
use Modules\Themes\Services\ThemeSeedApplier;
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
        // Capture the current active theme BEFORE the switch so the
        // `activated` hook can hand subscribers the previous slug for
        // diffing / cache invalidation. Framework's `activateTheme` is
        // in vendor, so we emit at the controller layer (no service
        // seam to hook into).
        $previous     = $this->themeManager->getActiveTheme();
        $previousSlug = is_array($previous) ? (string) ($previous['slug'] ?? '') : null;

        try {
            $this->themeManager->activateTheme($slug);
        } catch (ThemeNotFoundException) {
            return back()->withErrors(['slug' => __('Theme ":slug" not found.', ['slug' => $slug])]);
        }

        // Wrapped: the theme is already active at this point, so a
        // subscriber exception must not 500 the admin flow.
        $previousSlugOrNull = '' === $previousSlug ? null : $previousSlug;

        Hooks::safeDoAction(
            'keystone.admin.themes.activated',
            $slug,
            $previousSlugOrNull,
        );

        // #156 — the surface-agnostic `keystone.themes.activated` fires
        // from the vendor `ap.cmsFramework.theme.activating/activated`
        // bridge wired in AppServiceProvider, so it covers installer /
        // CLI activation paths uniformly. Nothing to emit here.

        // TODO(#20): dispatch PurgeCloudflareCacheJob once that job lands.
        // For now we rely on ThemeManager::activateTheme to clear the
        // discovery cache + the view cache. The purge-requested action
        // fires ahead of that job so a Cloudflare / Fastly / KeyCDN
        // plugin can subscribe today and drive its own edge purge from
        // the same event the future job will consume.
        //
        // Emitted BEFORE the seed step because the theme is already
        // active at this point — a partial-success seed failure still
        // needs an edge purge so visitors don't see the previous theme
        // out of a warm cache. Wrapped in `safeDoAction` so a broken
        // subscriber can't turn "theme activated" into a 500.
        Hooks::safeDoAction('keystone.cache.purgeRequested', [
            'scope' => 'theme',
            'tags'  => ['theme:'.$slug],
        ]);

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
