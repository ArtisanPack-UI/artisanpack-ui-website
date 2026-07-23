<?php

declare(strict_types=1);

namespace App\Support\ContentModel;

/**
 * Content type slugs handled by bespoke Keystone/framework controllers
 * (posts/pages have visual editor + featured-image + author on their
 * own PostController / PageController). The generic dynamic-content
 * pipeline (route, nav, visual-editor resource map) must skip these so
 * it never shadows the specialized paths.
 *
 * Single source of truth for the "reserved slug" list — before, the
 * same array lived in the dynamic controller, the admin menu builder,
 * and the visual-editor resource filter, so adding a new specialized
 * type meant patching three places in lockstep or letting one of them
 * silently shadow the specialized UI.
 */
final class SpecializedContentTypes
{
    /**
     * The framework registers built-in types with plural slugs (`posts`,
     * `pages`) while route-model bindings and nav keys sometimes still
     * use the singular. Reserve both spellings so a schema swap on
     * either side still filters correctly.
     *
     * @var list<string>
     */
    public const SLUGS = ['post', 'page', 'posts', 'pages'];

    public static function contains(string $slug): bool
    {
        return in_array($slug, self::SLUGS, true);
    }
}
