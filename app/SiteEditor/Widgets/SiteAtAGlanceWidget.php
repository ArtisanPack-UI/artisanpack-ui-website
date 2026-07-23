<?php

declare(strict_types=1);

namespace App\SiteEditor\Widgets;

use App\Models\User;
use App\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Post;
use ArtisanPackUI\CMSFramework\Modules\Pages\Models\Page;
use ArtisanPackUI\MediaLibrary\Models\Media;

/**
 * "Site at a glance" — counts of pages, posts, and media items, with
 * per-row toggles so users can hide rows that don't matter to them.
 *
 * Each toggle controls both the data emission (omitted rows are null) and
 * the React component's rendering. Comments are intentionally absent in
 * v1 — Keystone does not ship a Comment model yet (see #71 children) and
 * the issue explicitly scopes that row as "where applicable".
 */
class SiteAtAGlanceWidget implements KeystoneAdminWidgetInterface
{
    /**
     * @return array{title: string, description: string, default_options: array{show_pages: bool, show_posts: bool, show_media: bool}}
     */
    public static function getWidgetInfo(): array
    {
        return [
            'title'           => 'Site at a glance',
            'description'     => 'Counts of pages, posts, and media items.',
            'default_options' => [
                'show_pages' => true,
                'show_posts' => true,
                'show_media' => true,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     *
     * @return array{counts: array{pages: int|null, posts: int|null, media: int|null}}
     */
    public static function getData(User $user, array $options): array
    {
        return [
            'counts' => [
                'pages' => self::shouldShow($options, 'show_pages') ? Page::query()->count() : null,
                'posts' => self::shouldShow($options, 'show_posts') ? Post::query()->count() : null,
                'media' => self::shouldShow($options, 'show_media') ? Media::query()->count() : null,
            ],
        ];
    }

    /**
     * @return array{component: string, default_grid_config: array<string, array{rows: int, cols: int}>, settings_schema: array{fields: list<array{name: string, label: string, type: string, default: bool}>}}
     */
    public static function extendedInfo(): array
    {
        return [
            'component'           => 'SiteAtAGlanceWidget',
            'default_grid_config' => [
                'sm' => ['rows' => 2, 'cols' => 12],
                'md' => ['rows' => 1, 'cols' => 6],
                'lg' => ['rows' => 1, 'cols' => 4],
                'xl' => ['rows' => 1, 'cols' => 3],
            ],
            'settings_schema' => [
                'fields' => [
                    ['name' => 'show_pages', 'label' => 'Show pages count', 'type' => 'toggle', 'default' => true],
                    ['name' => 'show_posts', 'label' => 'Show posts count', 'type' => 'toggle', 'default' => true],
                    ['name' => 'show_media', 'label' => 'Show media count', 'type' => 'toggle', 'default' => true],
                ],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     */
    private static function shouldShow(array $options, string $key): bool
    {
        if (! array_key_exists($key, $options)) {
            return true;
        }

        // Fall back to the widget's true-by-default behavior when the persisted
        // value can't be coerced to a boolean, so a malformed payload doesn't
        // silently hide a row the user expects to see.
        $parsed = filter_var($options[$key], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

        return $parsed ?? true;
    }
}
