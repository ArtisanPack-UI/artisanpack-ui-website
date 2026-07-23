<?php

declare(strict_types=1);

namespace App\Support;

use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Post;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Enums\ContentStatus;
use ArtisanPackUI\CMSFramework\Modules\Settings\Managers\SettingsManager;

/**
 * Builds and resolves public post URLs from the configured permalink
 * structure (`permalinks.structure`).
 *
 * The structure is a WordPress-style template of literal path segments and
 * `%tag%` placeholders. Supported tags:
 *
 * - `%post_name%` — the post slug; the unique key used to resolve a request.
 * - `%year%`      — 4-digit publish year.
 * - `%monthnum%`  — 2-digit publish month.
 * - `%day%`       — 2-digit publish day.
 * - `%category%`  — the post's primary (first) category slug.
 *
 * {@see build()} turns the structure + a post into a URL; {@see resolve()}
 * parses an incoming request path back into the matching published post.
 * `/blog/{slug}` stays the hardcoded default/fallback route, so a structure
 * that omits `%post_name%` cannot round-trip and falls back to it.
 */
class PermalinkStructure
{
    /**
     * Regex fragments for each supported tag, used when compiling the
     * structure into a request matcher. Each fragment names its capture group
     * after the tag so {@see resolve()} can read the parsed segments back.
     *
     * @var array<string, string>
     */
    private const TAG_PATTERNS = [
        '%post_name%' => '(?P<post_name>[^/]+)',
        '%year%'      => '(?P<year>\d{4})',
        '%monthnum%'  => '(?P<monthnum>\d{1,2})',
        '%day%'       => '(?P<day>\d{1,2})',
        '%category%'  => '(?P<category>[^/]+)',
    ];

    public function __construct(private readonly SettingsManager $settings) {}

    /**
     * The configured structure, normalized to a single leading and trailing
     * slash. Falls back to the registered default (`/%post_name%/`) when the
     * stored value is blank.
     */
    public function structure(): string
    {
        $structure = trim((string) $this->settings->getSetting('permalinks.structure'));

        if ('' === $structure) {
            $structure = '/%post_name%/';
        }

        return '/'.trim($structure, '/').'/';
    }

    /**
     * Build the absolute public URL for a post from the configured structure.
     */
    public function build(Post $post): string
    {
        return url($this->path($post));
    }

    /**
     * Build the root-relative path (leading slash, no host) for a post.
     *
     * Falls back to the default `/blog/{slug}` path when the structure can't
     * produce a stable, resolvable URL: either it omits `%post_name%`, or it
     * uses date tags but the post has no publish date yet (a draft). This
     * keeps generated URLs deterministic and round-trippable through
     * {@see resolve()}, which only ever returns published posts.
     */
    public function path(Post $post): string
    {
        $structure = $this->structure();

        if (! str_contains($structure, '%post_name%')) {
            return '/blog/'.$post->slug;
        }

        $date = $post->published_at;

        if (null === $date && $this->hasDateTag($structure)) {
            return '/blog/'.$post->slug;
        }

        return strtr($structure, [
            '%post_name%' => $post->slug,
            '%year%'      => $date?->format('Y') ?? '',
            '%monthnum%'  => $date?->format('m') ?? '',
            '%day%'       => $date?->format('d') ?? '',
            '%category%'  => $this->primaryCategorySlug($post),
        ]);
    }

    /**
     * Resolve an incoming request path to the matching published post, or
     * null when the path doesn't match the structure or no post is found.
     */
    public function resolve(string $path): ?Post
    {
        $matches = $this->match($path);

        if (null === $matches) {
            return null;
        }

        $post = Post::query()
            ->where('slug', $matches['post_name'])
            ->where('status', ContentStatus::Published)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now())
            ->first();

        if (null === $post) {
            return null;
        }

        // Reject a structurally valid but mismatched date prefix so
        // `/1999/01/my-post/` cannot resolve a post published in 2026.
        if (! $this->dateSegmentsMatch($post, $matches)) {
            return null;
        }

        // Likewise reject a mismatched category segment so a wrong category
        // path (`/sports/my-post/` for a post in `news`) can't resolve by
        // slug alone and create a non-canonical duplicate URL.
        if (isset($matches['category']) && $matches['category'] !== $this->primaryCategorySlug($post)) {
            return null;
        }

        return $post;
    }

    /**
     * Whether the structure uses any date-derived tag.
     */
    private function hasDateTag(string $structure): bool
    {
        return str_contains($structure, '%year%')
            || str_contains($structure, '%monthnum%')
            || str_contains($structure, '%day%');
    }

    /**
     * Match a request path against the structure, returning the captured tag
     * values keyed by tag name (without `%`), or null when it doesn't match.
     *
     * @return array<string, string>|null
     */
    private function match(string $path): ?array
    {
        $structure = $this->structure();

        if (! str_contains($structure, '%post_name%')) {
            return null;
        }

        $normalized = '/'.trim($path, '/').'/';

        if (1 !== preg_match($this->toRegex($structure), $normalized, $matches)) {
            return null;
        }

        return array_filter(
            $matches,
            static fn (int|string $key): bool => is_string($key),
            ARRAY_FILTER_USE_KEY,
        );
    }

    /**
     * Compile a normalized structure into an anchored regex. Literal segments
     * are escaped so they can't be read as pattern syntax; known tags are
     * swapped for their named capture fragments.
     */
    private function toRegex(string $structure): string
    {
        $compiled = preg_replace_callback(
            '/(%[a-z_]+%)|([^%]+)/',
            static function (array $match): string {
                $tag = $match[1] ?? '';

                if ('' !== $tag) {
                    return self::TAG_PATTERNS[$tag] ?? preg_quote($tag, '#');
                }

                return preg_quote($match[2] ?? '', '#');
            },
            $structure,
        );

        return '#^'.$compiled.'$#';
    }

    /**
     * Confirm any year/month/day segments parsed from the request match the
     * post's publish date. Compared numerically so 1- and 2-digit months and
     * days both validate.
     *
     * @param  array<string, string>  $matches
     */
    private function dateSegmentsMatch(Post $post, array $matches): bool
    {
        $date = $post->published_at;

        if (null === $date) {
            return false;
        }

        if (isset($matches['year']) && (int) $matches['year'] !== (int) $date->format('Y')) {
            return false;
        }

        if (isset($matches['monthnum']) && (int) $matches['monthnum'] !== (int) $date->format('n')) {
            return false;
        }

        if (isset($matches['day']) && (int) $matches['day'] !== (int) $date->format('j')) {
            return false;
        }

        return true;
    }

    /**
     * The slug of the post's primary (first) category, or `uncategorized`
     * when the post has none. Uses the loaded relation when available to
     * avoid an extra query.
     */
    private function primaryCategorySlug(Post $post): string
    {
        $category = $post->relationLoaded('categories')
            ? $post->categories->first()
            : $post->categories()->first();

        return $category?->slug ?? 'uncategorized';
    }
}
