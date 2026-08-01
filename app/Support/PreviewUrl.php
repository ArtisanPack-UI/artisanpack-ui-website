<?php

declare(strict_types=1);

namespace App\Support;

use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Post;
use ArtisanPackUI\CMSFramework\Modules\Pages\Models\Page;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\URL;

/**
 * Generates signed preview URLs for draft/scheduled/published records.
 *
 * The URL points at the `preview.show` route (see routes/web.php) and
 * is signed with the app key via {@see URL::temporarySignedRoute()} so
 * anyone with the link can view the record through the active theme —
 * no session required — until the signature expires. The TTL is read
 * from `keystone.preview.ttl` (2h default, floor 60s).
 *
 * `null` for unsupported model types so callers can guard the Publish
 * panel's Preview button without a `try/catch`.
 */
class PreviewUrl
{
    public static function for(Model $model): ?string
    {
        $type = self::typeFor($model);

        if (null === $type) {
            return null;
        }

        $ttl = (int) config('keystone.preview.ttl', 7200);

        return URL::temporarySignedRoute(
            'preview.show',
            now()->addSeconds($ttl),
            ['type' => $type, 'id' => $model->getKey()],
        );
    }

    /**
     * The set of type slugs recognized by the preview route today.
     * Post and Page have first-class support because the Publish panel
     * ships with the Post/Page edit screens; CPTs will land when the
     * dynamic-content edit screens grow their own Publish panel.
     */
    public static function typeFor(Model $model): ?string
    {
        return match (true) {
            $model instanceof Post => 'post',
            $model instanceof Page => 'page',
            default                => null,
        };
    }
}
