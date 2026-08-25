<?php

declare(strict_types=1);

namespace Modules\Seo\Console\Commands;

use Illuminate\Console\Command;
use Modules\Seo\Support\SitemapEntryReconciler;

/**
 * Reconcile the `sitemap_entries` table and regenerate the XML.
 *
 * {@see \Modules\Seo\Observers\KeystoneSitemapObserver} keeps go-forward
 * saves correct, but rows written before it was in place — every draft /
 * private / scheduled record the vendor observer indexed on an existing
 * install (#234) — are only corrected when {@see SitemapEntryReconciler}
 * runs. That happens at install time; this command is the on-demand trigger
 * for an already-deployed site, so operators can flush the leak without
 * re-saving every model by hand.
 *
 * Runs the reconciler (plugin filter + visibility pass) and then the
 * vendor `seo:generate-sitemap` so the regenerated XML reflects the
 * corrected rows.
 */
class ReconcileSitemap extends Command
{
    protected $signature = 'seo:reconcile-sitemap {--skip-generate : Reconcile the entries table without regenerating the XML}';

    protected $description = 'Reconcile sitemap entries against public visibility, then regenerate the sitemap';

    public function handle(SitemapEntryReconciler $reconciler): int
    {
        $reconciler->apply();

        $this->info('Reconciled sitemap entries against public visibility.');

        if ($this->option('skip-generate')) {
            return self::SUCCESS;
        }

        // Surface a failed regeneration rather than masking it behind a
        // successful reconcile — the caller (or CI) needs the real status.
        return $this->call('seo:generate-sitemap');
    }
}
