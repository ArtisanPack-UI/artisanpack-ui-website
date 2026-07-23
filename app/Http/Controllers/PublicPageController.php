<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\PermalinkStructure;
use App\Support\SiteBranding;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Enums\ContentStatus;
use ArtisanPackUI\CMSFramework\Modules\Pages\Models\Page;
use ArtisanPackUI\CMSFramework\Modules\SiteEditor\Models\GlobalStyles;
use ArtisanPackUI\CMSFramework\Modules\SiteEditor\Resolution\TemplatePartResolver;
use ArtisanPackUI\CMSFramework\Modules\Themes\Managers\ThemeManager;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/**
 * Public-facing renderer for CMS pages. Resolves a {@see Page} by slug
 * (or homepage via the `site.homepageId` setting for `/`), picks a
 * Blade template from the active theme using the WP-style hierarchy in
 * {@see ThemeManager::resolveTemplate()}, and hands `$page` to the
 * theme's Blade view.
 *
 * The theme's template is expected to render `$page->getBlockContent()`
 * through `<x-ve-blocks>` so the visual-editor's Blade renderer + the
 * template-part inliner handle the actual block-tree → HTML pass.
 */
class PublicPageController extends Controller
{
    public function __construct(
        private ThemeManager $themeManager,
        private TemplatePartResolver $templateParts,
        private PermalinkStructure $permalinks,
    ) {}

    public function home(): View
    {
        $page = $this->resolveHomepage();

        if (null === $page) {
            throw new NotFoundHttpException;
        }

        return $this->renderPage($page);
    }

    public function show(string $path): View|SymfonyResponse
    {
        // The path matched by the catch-all may carry nested segments
        // (e.g. `parent/child`). Pages live in a flat slug namespace today,
        // so we look up by the trailing segment. Hierarchy-aware permalink
        // resolution is deferred until Pages grow nested public URLs.
        $slug = (string) last(explode('/', trim($path, '/')));

        if ('' === $slug) {
            throw new NotFoundHttpException;
        }

        $page = Page::query()
            ->where('slug', $slug)
            ->where('status', ContentStatus::Published)
            ->first();

        if (null !== $page) {
            return $this->renderPage($page);
        }

        // No page matched — posts and pages share the public namespace, so
        // try resolving the path as a blog post per the configured permalink
        // structure. Gated on the blog feature flag to mirror the dedicated
        // blog routes' `feature:blog` middleware (404 when disabled).
        if ((bool) keystone('features.blog', false)) {
            $post = $this->permalinks->resolve($path);

            if (null !== $post) {
                return app(BlogController::class)->renderPost($post);
            }
        }

        throw new NotFoundHttpException;
    }

    private function renderPage(Page $page): View
    {
        // Eager-load the relations the SEO Blade components read in the
        // theme head. `seoMeta` drives meta/OG/Twitter resolution;
        // `featuredImageMedia` is the fallback OG / schema image. Both
        // would otherwise lazy-load mid-template and trip an N+1.
        $page->loadMissing(['seoMeta', 'featuredImageMedia']);

        // Re-register the theme view path here because the active theme may
        // have changed since service-provider boot (e.g. tests that activate
        // a theme inside the request lifecycle, or admin actions that flip
        // the active theme between requests handled by the same worker).
        $this->themeManager->registerThemeViewPath();

        $template = $this->themeManager->resolveTemplate('page', $page->slug);

        $activeSlug = $this->themeManager->getActiveTheme()['slug'] ?? null;

        return view($template, [
            'page'         => $page,
            'activeTheme'  => $activeSlug,
            'headerBlocks' => $this->resolvePartBlocks('header'),
            'footerBlocks' => $this->resolvePartBlocks('footer'),
            'themeJson'    => $this->readThemeJson($activeSlug),
            'siteIcon'     => SiteBranding::icon(),
        ]);
    }

    /**
     * Read the active theme's `theme.json` and merge any user customizations
     * stored in the `global_styles` table so the public template hands the
     * combined payload to `<x-ve-blocks-styles>`. Site-editor saves write
     * to `global_styles.{settings, styles}`; without the merge the public
     * site sees only the theme's shipped defaults and changes authored in
     * the global-styles panel never paint on the front end.
     *
     * Validates the slug to keep the path concatenation safe even though
     * the slug already comes from the theme-manager surface.
     *
     * @return array<string, mixed>|null
     */
    private function readThemeJson(?string $themeSlug): ?array
    {
        if (null === $themeSlug || 1 !== preg_match('/^[a-z0-9][a-z0-9_\-]*$/i', $themeSlug)) {
            return null;
        }

        $path = base_path((string) config('cms.themes.directory', 'themes')).'/'.$themeSlug.'/theme.json';

        if (! File::exists($path)) {
            return null;
        }

        $decoded = json_decode(File::get($path), true);

        if (! is_array($decoded)) {
            return null;
        }

        return $this->mergeGlobalStylesOverride($decoded, $themeSlug);
    }

    /**
     * Deep-merge the user's `global_styles` row over the theme's defaults.
     *
     * Walks both trees in tandem via {@see mergeThemeJsonTree}:
     * associative sub-maps recurse so keys the user hasn't touched stay
     * on the theme value, while list-shaped sections (color palette,
     * typography fontSizes, spacing spacingSizes — anything keyed by
     * sequential integers) are replaced wholesale by the override. A
     * naive `array_replace_recursive` merges list indexes one-by-one
     * and keeps trailing theme defaults when the user shortens or
     * reorders a list, so the public payload would diverge from the
     * editor state at the first palette edit.
     *
     * Silently no-ops when the `global_styles` table doesn't yet exist
     * (fresh install before migrations) or when no row matches the
     * active theme slug.
     *
     * @param  array<string, mixed>  $themeJson
     *
     * @return array<string, mixed>
     */
    private function mergeGlobalStylesOverride(array $themeJson, string $themeSlug): array
    {
        try {
            $override = GlobalStyles::query()->where('theme', $themeSlug)->first();
        } catch (Throwable) {
            // global_styles table missing or otherwise unreadable — fall
            // back to the disk theme.json so the site still renders.
            return $themeJson;
        }

        if (null === $override) {
            return $themeJson;
        }

        if (is_array($override->settings) && [] !== $override->settings) {
            $themeJson['settings'] = $this->mergeThemeJsonTree(
                is_array($themeJson['settings'] ?? null) ? $themeJson['settings'] : [],
                $override->settings,
            );
        }

        if (is_array($override->styles) && [] !== $override->styles) {
            $themeJson['styles'] = $this->mergeThemeJsonTree(
                is_array($themeJson['styles'] ?? null) ? $themeJson['styles'] : [],
                $override->styles,
            );
        }

        return $themeJson;
    }

    /**
     * Recursive deep-merge that distinguishes assoc maps from numeric
     * lists. Maps merge key-by-key; lists are replaced wholesale.
     *
     * theme.json carries both shapes side-by-side — `settings.color`
     * is a map with a `palette` key whose value is a list. Without the
     * shape switch a user palette of 3 entries layered over a theme
     * palette of 6 leaves entries 4-6 from the theme in the public
     * payload while the editor only renders the user's 3. The shape
     * check uses `array_is_list` (PHP 8.1+) so we don't have to walk
     * keys ourselves.
     *
     * @param  array<int|string, mixed>  $base
     * @param  array<int|string, mixed>  $override
     *
     * @return array<int|string, mixed>
     */
    private function mergeThemeJsonTree(array $base, array $override): array
    {
        if (array_is_list($override)) {
            return $override;
        }

        foreach ($override as $key => $value) {
            $baseValue = $base[$key] ?? null;

            if (is_array($value) && is_array($baseValue)) {
                $base[$key] = $this->mergeThemeJsonTree($baseValue, $value);

                continue;
            }

            $base[$key] = $value;
        }

        return $base;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function resolvePartBlocks(string $slug): array
    {
        $resolved = $this->templateParts->resolve($slug);

        return null !== $resolved ? $resolved->blocks : [];
    }

    private function resolveHomepage(): ?Page
    {
        $homepageId = apGetSetting('site.homepageId');

        if (is_numeric($homepageId)) {
            $page = Page::query()
                ->whereKey((int) $homepageId)
                ->where('status', ContentStatus::Published)
                ->first();

            if (null !== $page) {
                return $page;
            }
        }

        // Fallback: slug `home`. Keeps front-end working when settings
        // haven't been seeded yet (fresh install before activate).
        return Page::query()
            ->where('slug', 'home')
            ->where('status', ContentStatus::Published)
            ->first();
    }
}
