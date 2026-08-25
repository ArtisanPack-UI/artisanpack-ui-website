<?php

declare(strict_types=1);

namespace Modules\Blog\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Support\Content\PublicVisibility;
use App\Support\PermalinkStructure;
use App\Support\SiteBranding;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Post;
use ArtisanPackUI\CMSFramework\Modules\SiteEditor\Models\GlobalStyles;
use ArtisanPackUI\CMSFramework\Modules\SiteEditor\Resolution\TemplatePartResolver;
use ArtisanPackUI\CMSFramework\Modules\Themes\Managers\ThemeManager;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\File;
use Inertia\Inertia;
use Modules\Themes\Support\ThemeTemplateLocator;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Throwable;

/**
 * Public-facing blog routes (`/blog` and `/blog/{slug}`).
 *
 * `/blog/{slug}` is the hardcoded default/fallback post URL. Posts also
 * resolve at their configured permalink (`permalinks.structure`) via the
 * public catch-all in {@see \App\Http\Controllers\PublicPageController::show()},
 * which hands the resolved post to {@see renderPost()}.
 *
 * Both endpoints are gated by the `feature:blog` middleware at the route
 * layer — when `KEYSTONE_BLOG_ENABLED=false` the routes 404 instead of
 * 403 so the disabled feature is indistinguishable from a missing route.
 *
 * Responses include `Cache-Tag` headers so the Cloudflare edge can purge
 * granularly when a post is updated (e.g. tag `blog:post:42`).
 */
class BlogController extends Controller
{
    public function __construct(
        private readonly PermalinkStructure $permalinks,
        private readonly ThemeManager $themeManager,
        private readonly ThemeTemplateLocator $templateLocator,
        private readonly TemplatePartResolver $templateParts,
    ) {}

    public function index(): SymfonyResponse
    {
        doAction('keystone.public.render.blogIndex.before');

        $query = PublicVisibility::posts(
            Post::query()->with(['author:id,display_name', 'categories:id,slug']),
        )->latest('published_at');

        /** @var \Illuminate\Database\Eloquent\Builder<Post> $query */
        $query = applyFilters('keystone.public.blog.index.query', $query);

        /** @var int $perPage */
        $perPage = (int) applyFilters('keystone.public.blog.index.perPage', 20);

        $posts = $query
            ->limit(max(1, $perPage))
            ->get(['id', 'title', 'slug', 'excerpt', 'author_id', 'published_at']);

        $data = [
            'posts' => $posts->map(fn (Post $post) => [
                'id'                   => $post->id,
                'title'                => $post->title,
                'slug'                 => $post->slug,
                'url'                  => $this->permalinks->build($post),
                'excerpt'              => $post->excerpt,
                'author'               => $post->author?->display_name,
                'published_at'         => optional($post->published_at)->toISOString(),
                'published_at_display' => keystone_format_date($post->published_at),
            ])->all(),
        ];

        /** @var array<string, mixed> $data */
        $data = applyFilters('keystone.public.render.viewData', $data, [
            'surface' => 'blogIndex',
        ]);

        $response = Inertia::render('blog/Index', $data)->toResponse(request());

        /** @var string $cacheTag */
        $cacheTag = (string) applyFilters('keystone.public.http.cacheTags', 'blog:index', [
            'surface' => 'blogIndex',
        ]);

        $response = $response->header('Cache-Tag', $cacheTag);

        doAction('keystone.public.render.blogIndex.after', $response);

        return $response;
    }

    public function show(string $slug): SymfonyResponse
    {
        $post = PublicVisibility::posts(
            Post::query()->with('author:id,display_name')->where('slug', $slug),
        )->first();

        if (null === $post) {
            abort(HttpResponse::HTTP_NOT_FOUND);
        }

        return $this->renderPost($post);
    }

    /**
     * Render the public detail view for an already-resolved published post.
     * Shared by the `/blog/{slug}` fallback route and the permalink-structure
     * resolver so both surfaces emit identical markup and cache tags.
     *
     * The render pipeline mirrors
     * {@see \App\Http\Controllers\PublicPageController::renderPage}:
     * resolve the view and the site-editor block tree through
     * {@see ThemeTemplateLocator} — both walk the same WP-style hierarchy
     * (single-post-{slug} → single-post → single → index), the first over
     * the theme's Blade files and the second over the site-editor store
     * (DB rows merged with the theme's `templates/*.html`) — then hand
     * both to the view together with the post entity. The template renders
     * the template's block tree through `<x-ve-blocks :post="$post">` so
     * visual-editor's PostResolver + CommentInliner stamp the post-* and
     * comment-* blocks against the live post.
     *
     * `$isPreview` suppresses the `keystone.public.render.post.*` actions
     * AND the `Cache-Tag` header. Subscribers to those hooks are wired
     * for public loads (analytics, view counters, CDN cache warm) and
     * would misfire on preview clicks. The `Cache-Tag` matters because
     * a Cloudflare purge keyed on `blog:post:{id}` after an edit would
     * otherwise sweep the preview response out of edge cache too.
     */
    public function renderPost(Post $post, bool $isPreview = false): SymfonyResponse
    {
        $post->loadMissing(['seoMeta', 'featuredImageMedia']);

        $this->themeManager->registerThemeViewPath();

        // Resolves to the theme's own Blade template, or to Keystone's
        // `block-theme` layout when the theme ships no Blade at all.
        $template   = $this->templateLocator->viewFor('post', $post->slug);
        $activeSlug = $this->themeManager->getActiveTheme()['slug'] ?? null;

        if (! $isPreview) {
            doAction('keystone.public.render.post.before', $post);
        }

        $data = [
            'post'           => $post,
            // Legacy alias: themes/jmwd-default/index.blade.php (and any
            // template falling back to it) still references `$page`.
            // Aliasing here so the same Blade file serves both surfaces
            // without a branch.
            'page'           => $post,
            'templateBlocks' => $this->templateLocator->blocksFor('post', $post->slug),
            'activeTheme'    => $activeSlug,
            'headerBlocks'   => $this->resolvePartBlocks('header'),
            'footerBlocks'   => $this->resolvePartBlocks('footer'),
            'themeJson'      => $this->readThemeJson($activeSlug),
            'siteIcon'       => SiteBranding::icon(),
        ];

        /** @var array<string, mixed> $data */
        $data = applyFilters('keystone.public.render.viewData', $data, [
            'surface' => 'post',
            'post'    => $post,
        ]);

        $view = view($template, $data);

        $response = response($view->render());

        if (! $isPreview) {
            /** @var string $cacheTag */
            $cacheTag = (string) applyFilters(
                'keystone.public.http.cacheTags',
                'blog:post:'.$post->id.',blog:index',
                [
                    'surface' => 'post',
                    'post'    => $post,
                ],
            );

            $response = $response->header('Cache-Tag', $cacheTag);

            doAction('keystone.public.render.post.after', $post, $response);
        }

        return $response;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function resolvePartBlocks(string $slug): array
    {
        $resolved = $this->templateParts->resolve($slug);

        return null !== $resolved ? $resolved->blocks : [];
    }

    /**
     * Read the active theme's `theme.json` and merge any user customizations
     * stored in the `global_styles` table — see \App\Http\Controllers\PublicPageController for
     * the full rationale; this is a verbatim copy of that logic so the
     * post-render path emits the same combined payload.
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

        try {
            $override = GlobalStyles::query()->where('theme', $themeSlug)->first();
        } catch (Throwable) {
            return $decoded;
        }

        if (null === $override) {
            return $decoded;
        }

        if (is_array($override->settings) && [] !== $override->settings) {
            $decoded['settings'] = $this->mergeThemeJsonTree(
                is_array($decoded['settings'] ?? null) ? $decoded['settings'] : [],
                $override->settings,
            );
        }

        if (is_array($override->styles) && [] !== $override->styles) {
            $decoded['styles'] = $this->mergeThemeJsonTree(
                is_array($decoded['styles'] ?? null) ? $decoded['styles'] : [],
                $override->styles,
            );
        }

        return $decoded;
    }

    /**
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
}
