<?php

declare(strict_types=1);

namespace Modules\Blog\Console\Commands;

use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Post;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Enums\ContentStatus;
use ArtisanPackUI\CMSFramework\Modules\Pages\Models\Page;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;

/**
 * Flip Scheduled posts and pages whose publish date has arrived over to
 * Published.
 *
 * The editor treats "Scheduled" as a first-class status and the admin's
 * status pill already reports a past-dated scheduled record as live, but
 * nothing was actually moving the DB column — so a scheduled post stayed
 * `scheduled` forever and its public URL 404'd. This command is that
 * missing worker; {@see \Modules\Blog\Providers\BlogServiceProvider} registers
 * it to run every minute.
 *
 * Records are saved one at a time rather than mass-updated so the
 * framework's `FiresLifecycleHooks` trait emits
 * `ap.cmsFramework.{post,page}.published` for each one — cache purges,
 * search reindexing, and notification subscribers all hang off that
 * transition, and a bulk `UPDATE` would skip every one of them.
 *
 * Only posts and pages are handled. Dynamic content types don't surface a
 * "scheduled" state on any public surface yet, so there is nothing for a
 * flip to unblock there.
 */
class PublishScheduledContent extends Command
{
    protected $signature = 'keystone:publish-scheduled';

    protected $description = 'Publish scheduled posts and pages whose publish date has passed';

    public function handle(): int
    {
        $published = $this->publishDue(Post::query(), 'post')
            + $this->publishDue(Page::query(), 'page');

        if (0 === $published) {
            $this->info('Nothing due.');

            return self::SUCCESS;
        }

        $this->info("Published {$published} scheduled record(s).");

        return self::SUCCESS;
    }

    /**
     * Flip every due row reachable from `$query` and return how many were
     * changed.
     *
     * `chunkById` rather than `chunk`: the update removes each row from the
     * result set, so an OFFSET-paged walk would skip half the backlog at
     * every page boundary. Keyset pagination on the primary key is immune
     * to that.
     *
     * @param  Builder<\Illuminate\Database\Eloquent\Model>  $query
     */
    private function publishDue(Builder $query, string $label): int
    {
        $count = 0;

        $query
            ->where('status', ContentStatus::Scheduled)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now())
            ->chunkById(100, function ($records) use (&$count, $label): void {
                foreach ($records as $record) {
                    $record->status = ContentStatus::Published;
                    $record->save();

                    $count++;

                    $this->line("Published {$label} #{$record->getKey()}: {$record->title}");
                }
            });

        return $count;
    }
}
