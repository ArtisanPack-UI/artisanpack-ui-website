<?php

declare(strict_types=1);

namespace App\SiteEditor\Widgets;

use App\Models\User;
use App\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Post;
use ArtisanPackUI\CMSFramework\Modules\Pages\Models\Page;
use Illuminate\Database\Eloquent\Model;

/**
 * "Recent activity" — latest edits across Pages + Posts, merged and
 * re-sorted by `updated_at` so the freshest item appears first.
 *
 * Each enabled type is queried for the most recent `limit` rows (so a
 * burst of edits on one type can still saturate the list), then the
 * combined set is re-sorted and sliced back down to `limit`. With the
 * default `limit=5` and both types enabled this issues two cheap queries
 * — fine for a dashboard widget.
 */
class RecentActivityWidget implements KeystoneAdminWidgetInterface
{
    private const DEFAULT_LIMIT = 5;

    private const MIN_LIMIT = 1;

    private const MAX_LIMIT = 20;

    /** @var list<string> */
    private const SUPPORTED_INCLUDES = ['pages', 'posts'];

    /**
     * @return array{title: string, description: string, default_options: array{limit: int, include: list<string>}}
     */
    public static function getWidgetInfo(): array
    {
        return [
            'title'           => 'Recent activity',
            'description'     => 'Latest page and post edits, merged and sorted.',
            'default_options' => [
                'limit'   => self::DEFAULT_LIMIT,
                'include' => self::SUPPORTED_INCLUDES,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     *
     * @return array{items: list<array{type: string, id: int, title: string, updated_at: string, edit_url: string}>}
     */
    public static function getData(User $user, array $options): array
    {
        $limit   = self::resolveLimit($options);
        $include = self::resolveInclude($options);

        $items = [];

        if (in_array('pages', $include, true)) {
            foreach (self::latestPages($limit) as $page) {
                $items[] = self::shapeItem('page', $page, route('admin.pages.edit', ['page' => $page->getKey()]));
            }
        }

        if (in_array('posts', $include, true)) {
            foreach (self::latestPosts($limit) as $post) {
                $items[] = self::shapeItem('post', $post, route('admin.posts.edit', ['post' => $post->getKey()]));
            }
        }

        usort($items, static fn (array $a, array $b): int => strcmp($b['updated_at'], $a['updated_at']));

        return [
            'items' => array_slice($items, 0, $limit),
        ];
    }

    /**
     * @return array{component: string, default_grid_config: array<string, array{rows: int, cols: int}>, settings_schema: array{fields: list<array<string, mixed>>}}
     */
    public static function extendedInfo(): array
    {
        return [
            'component'           => 'RecentActivityWidget',
            'default_grid_config' => [
                'sm' => ['rows' => 3, 'cols' => 12],
                'md' => ['rows' => 3, 'cols' => 12],
                'lg' => ['rows' => 3, 'cols' => 6],
                'xl' => ['rows' => 3, 'cols' => 4],
            ],
            'settings_schema' => [
                'fields' => [
                    [
                        'name'    => 'limit',
                        'label'   => 'Number of items',
                        'type'    => 'number',
                        'min'     => self::MIN_LIMIT,
                        'max'     => self::MAX_LIMIT,
                        'default' => self::DEFAULT_LIMIT,
                    ],
                    [
                        'name'    => 'include',
                        'label'   => 'Include',
                        'type'    => 'multiselect',
                        'default' => self::SUPPORTED_INCLUDES,
                        'options' => [
                            ['value' => 'pages', 'label' => 'Pages'],
                            ['value' => 'posts', 'label' => 'Posts'],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, Page>
     */
    private static function latestPages(int $limit): \Illuminate\Database\Eloquent\Collection
    {
        return Page::query()
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->get(['id', 'title', 'updated_at']);
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, Post>
     */
    private static function latestPosts(int $limit): \Illuminate\Database\Eloquent\Collection
    {
        return Post::query()
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->get(['id', 'title', 'updated_at']);
    }

    /**
     * @return array{type: string, id: int, title: string, updated_at: string, edit_url: string}
     */
    private static function shapeItem(string $type, Model $record, string $editUrl): array
    {
        return [
            'type'       => $type,
            'id'         => (int) $record->getKey(),
            'title'      => (string) $record->getAttribute('title'),
            'updated_at' => $record->getAttribute('updated_at')->toISOString(),
            'edit_url'   => $editUrl,
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     */
    private static function resolveLimit(array $options): int
    {
        $candidate = $options['limit'] ?? null;

        if (! is_numeric($candidate)) {
            return self::DEFAULT_LIMIT;
        }

        return max(self::MIN_LIMIT, min(self::MAX_LIMIT, (int) $candidate));
    }

    /**
     * @param  array<string, mixed>  $options
     *
     * @return list<string>
     */
    private static function resolveInclude(array $options): array
    {
        $candidate = $options['include'] ?? null;

        if (! is_array($candidate)) {
            return self::SUPPORTED_INCLUDES;
        }

        $filtered = array_values(array_intersect(self::SUPPORTED_INCLUDES, array_filter($candidate, 'is_string')));

        return [] === $filtered ? self::SUPPORTED_INCLUDES : $filtered;
    }
}
