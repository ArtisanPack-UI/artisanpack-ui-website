<?php

declare(strict_types=1);

namespace Modules\Seo\Observers;

use App\Support\Content\PublicVisibility;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Post;
use ArtisanPackUI\CMSFramework\Modules\Pages\Models\Page;
use ArtisanPackUI\SEO\Observers\SitemapObserver;
use Illuminate\Database\Eloquent\Model;

/**
 * Keystone sitemap observer that keeps `sitemap_entries` in step with
 * {@see PublicVisibility}, the single definition of "this record is live
 * on the public site."
 *
 * The vendor {@see SitemapObserver} writes a row on every Page / Post save
 * and derives inclusion / `is_indexable` solely from the SEO meta flags
 * (`exclude_from_sitemap`, `no_index`). It never consults content status,
 * so a `draft`, `private`, or not-yet-due `scheduled` record lands in
 * `sitemap.xml` with `is_indexable = true` even though its public URL
 * 404s — leaking the slug and URL structure of unpublished work (#234).
 *
 * Rather than re-derive visibility from a URL string, this subclass gates
 * on the same query scopes the public `PublicPageController` /
 * `BlogController` use:
 *
 * - {@see shouldTrackInSitemap()} is the authoritative write gate. A record
 *   a visitor cannot reach is dropped from the sitemap entirely (the parent
 *   deletes the row when tracking is off). When the record is later
 *   published the next save re-creates its entry, since the parent runs
 *   `updateOrCreate` on every save. Because this gate already guarantees a
 *   row is only written for public content, `getModelIndexable()` is left
 *   to the vendor (SEO-meta) behaviour — no second visibility query per
 *   save.
 * - {@see deleted()} closes the soft-delete gap. The vendor only removes
 *   the row on force-delete, so a trashed (soft-deleted) published record
 *   would otherwise keep an indexable entry on the live sitemap route. A
 *   later restore re-adds it through the parent `restored()` hook, which
 *   routes back through {@see shouldTrackInSitemap()}.
 *
 * Only Page and Post carry a `status` column and a `PublicVisibility`
 * definition; any other model type falls through to the vendor behaviour.
 */
class KeystoneSitemapObserver extends SitemapObserver
{
    /**
     * Remove the sitemap entry for a soft-deleted record too. The parent
     * keeps the row on soft-delete (only force-delete removes it), but a
     * trashed record is unreachable on the public site, so its URL must
     * leave the sitemap (#234).
     */
    public function deleted(Model $model): void
    {
        parent::deleted($model);

        if (method_exists($model, 'trashed') && $model->trashed()) {
            $this->deleteSitemapEntry($model);
        }
    }

    /**
     * Track a model in the sitemap only when the vendor rules allow it
     * *and* the record is publicly visible.
     */
    protected function shouldTrackInSitemap(Model $model): bool
    {
        return parent::shouldTrackInSitemap($model) && $this->isPubliclyVisible($model);
    }

    /**
     * Resolve public visibility through the shared {@see PublicVisibility}
     * scopes so the sitemap can never disagree with what the public site
     * actually serves. Unknown model types keep the vendor default.
     */
    protected function isPubliclyVisible(Model $model): bool
    {
        if ($model instanceof Post) {
            return PublicVisibility::posts(Post::query()->whereKey($model->getKey()))->exists();
        }

        if ($model instanceof Page) {
            return PublicVisibility::pages(Page::query()->whereKey($model->getKey()))->exists();
        }

        return true;
    }
}
