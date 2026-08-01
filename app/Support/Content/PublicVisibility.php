<?php

declare(strict_types=1);

namespace App\Support\Content;

use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Enums\ContentStatus;
use Illuminate\Contracts\Database\Query\Builder as BuilderContract;

/**
 * The single definition of "this record is live on the public site."
 *
 * Scheduled content is flipped to Published by
 * {@see \App\Console\Commands\PublishScheduledContent}, but cron granularity
 * is a floor, not a guarantee — a stalled worker, a machine that was asleep,
 * or simply the seconds between the minute ticking over and the sweep
 * finishing all leave a window where a record is due but its `status` column
 * still says `scheduled`. Rather than let the public site 404 through that
 * window, both scopes below treat a scheduled row whose date has passed as
 * live. That's the same predicate the admin's status pill already uses
 * (`PostController::actualStatus()`), so the two surfaces can no longer
 * disagree.
 *
 * Posts and pages deliberately differ on the date gate:
 *
 * - **Posts** have always required a non-null `published_at` that is not in
 *   the future; permalinks are built from that date, so a post without one
 *   has no stable URL to serve.
 * - **Pages** are live on `status` alone. Pages have no date-derived URL, and
 *   plenty of legitimately published pages (installer fixtures, imported
 *   content, anything created before `published_at` was stamped) carry a null
 *   date. Adding a date gate here would silently unpublish them.
 *
 * A future-dated *published* record is prevented at the write layer instead —
 * see `HandlesPublication::resolvePublication()`, which coerces that
 * combination to Scheduled so both content types behave the same way.
 */
final class PublicVisibility
{
    /**
     * Constrain a Post query to posts a visitor may see.
     *
     * @template TBuilder of BuilderContract
     *
     * @param  TBuilder  $query
     *
     * @return TBuilder
     */
    public static function posts(BuilderContract $query): BuilderContract
    {
        return $query
            ->whereIn('status', [
                ContentStatus::Published->value,
                ContentStatus::Scheduled->value,
            ])
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    /**
     * Constrain a Page query to pages a visitor may see.
     *
     * @template TBuilder of BuilderContract
     *
     * @param  TBuilder  $query
     *
     * @return TBuilder
     */
    public static function pages(BuilderContract $query): BuilderContract
    {
        return $query->where(static function (BuilderContract $inner): void {
            $inner
                ->where('status', ContentStatus::Published->value)
                ->orWhere(static function (BuilderContract $due): void {
                    $due->where('status', ContentStatus::Scheduled->value)
                        ->whereNotNull('published_at')
                        ->where('published_at', '<=', now());
                });
        });
    }
}
