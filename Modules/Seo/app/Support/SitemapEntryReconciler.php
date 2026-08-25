<?php

declare(strict_types=1);

namespace Modules\Seo\Support;

use App\Support\Content\PublicVisibility;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Post;
use ArtisanPackUI\CMSFramework\Modules\Pages\Models\Page;
use ArtisanPackUI\SEO\Models\SitemapEntry;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Support\Collection;
use Throwable;

/**
 * Reconciles the `sitemap_entries` table before the vendor SEO package
 * regenerates the XML output. Two passes, in order:
 *
 * 1. **Plugin filter.** The `keystone.seo.sitemap.entries` filter lets
 *    plugin authors hide a URL from the sitemap without touching the
 *    underlying model (a staging page, a plugin-owned resource whose
 *    canonical lives elsewhere) — the shared extension seam. Subscribers
 *    receive the current entries as an array of
 *    `{url, type, is_indexable, priority, changefreq, last_modified}`
 *    associative arrays and return the (possibly-mutated) list.
 *
 * 2. **Visibility (#234).** Every row whose backing Page / Post is not
 *    publicly visible — `draft`, `private`, a not-yet-due `scheduled`
 *    record, or a soft-/hard-deleted model that left the row orphaned — is
 *    flipped to `is_indexable=false`. Visibility is resolved from the row's
 *    own polymorphic FK through {@see PublicVisibility}, the single
 *    definition of "live on the public site", so it never re-derives status
 *    from the URL string. This corrects rows written by the vendor observer
 *    before {@see \Modules\Seo\Observers\KeystoneSitemapObserver} was in
 *    place (which only gates go-forward saves), so existing installs stop
 *    leaking unpublished slugs.
 *
 * Visibility runs **after** the plugin filter, and deliberately: the filter
 * is treated as untrusted plugin output, so a subscriber must not be able
 * to re-index an unpublished record by returning `is_indexable=true` for
 * its URL. The visibility pass is the authoritative last word — it only
 * ever flips indexable rows *off*, never on, so a plugin can still hide a
 * genuinely-public URL through the filter.
 *
 * The reconciler operates only on the `is_indexable` and per-row
 * priority/changefreq/type/last_modified columns — it never inserts or
 * deletes rows, because the vendor schema requires a polymorphic FK on
 * every row (`sitemapable_type` + `sitemapable_id` are NOT NULL) and a
 * plugin-owned URL has no host model to point to. To hide an entry via the
 * filter, subscribers omit it from the returned list; the reconciler flips
 * `is_indexable=false` on the row so vendor's `SitemapEntry::indexable()`
 * scope skips it during XML generation.
 *
 * `apply()` is invoked at install
 * ({@see \Modules\Installer\Services\InstallationService::generateSitemap()})
 * and on demand via the `seo:reconcile-sitemap` command. Fresh installs
 * where `sitemap_entries` doesn't exist yet no-op — both passes swallow the
 * missing-table error rather than throwing so the caller can continue.
 */
class SitemapEntryReconciler
{
    public function apply(): void
    {
        $this->applyEntriesFilter();

        $this->deindexNonPublicEntries();
    }

    /**
     * Flip `is_indexable=false` on every indexable entry whose backing
     * Page / Post is not publicly visible, or whose model no longer
     * resolves (soft-/hard-deleted, leaving the row orphaned). Rows for
     * morph types Keystone doesn't own — plugin-owned URLs — are left
     * untouched, since there is no host model to judge against
     * {@see PublicVisibility}.
     *
     * Streamed per morph type in id-ordered chunks so an install with a
     * very large `sitemap_entries` table never loads the whole set into
     * memory: each chunk needs one visibility query and at most one UPDATE.
     * `chunkById` stays correct while we mutate `is_indexable` because the
     * cursor advances by primary key and deindexed rows sit behind it.
     */
    protected function deindexNonPublicEntries(): void
    {
        foreach ($this->supportedMorphTypes() as $type => $scope) {
            try {
                SitemapEntry::query()
                    ->where('is_indexable', true)
                    ->where('sitemapable_type', $type)
                    ->select(['id', 'sitemapable_id'])
                    ->chunkById(500, function (Collection $chunk) use ($scope): void {
                        $this->deindexChunk($chunk, $scope);
                    });
            } catch (Throwable) {
                // Partial / mid-migration schema (e.g. the pages or posts
                // table is absent): no-op for this type rather than throw,
                // per the class contract.
                continue;
            }
        }
    }

    /**
     * Deindex the non-public rows within a single chunk of entries, keyed
     * to one content type. `$scope` selects the matching
     * {@see PublicVisibility} constraint.
     *
     * @param  Collection<int, SitemapEntry>  $chunk
     */
    protected function deindexChunk(Collection $chunk, string $scope): void
    {
        $ids = $chunk
            ->pluck('sitemapable_id')
            ->reject(fn ($id): bool => null === $id)
            ->all();

        if ([] === $ids) {
            return;
        }

        $visible = 'posts' === $scope
            ? PublicVisibility::posts(Post::query()->whereKey($ids))->pluck((new Post)->getKeyName())->all()
            : PublicVisibility::pages(Page::query()->whereKey($ids))->pluck((new Page)->getKeyName())->all();

        $visibleSet = array_flip(array_map('strval', $visible));

        $deindexIds = $chunk
            ->reject(fn (SitemapEntry $entry): bool => isset($visibleSet[(string) $entry->sitemapable_id]))
            ->pluck('id')
            ->all();

        if ([] !== $deindexIds) {
            SitemapEntry::query()->whereKey($deindexIds)->update(['is_indexable' => false]);
        }
    }

    /**
     * The `sitemapable_type` values Keystone owns, mapped to their
     * {@see PublicVisibility} scope. Keyed by the same morph string the
     * vendor observer writes (`$model->getMorphClass()`), so the lookup
     * matches whether or not a morph map is registered.
     *
     * @return array<string, string>
     */
    protected function supportedMorphTypes(): array
    {
        return [
            (new Post)->getMorphClass() => 'posts',
            (new Page)->getMorphClass() => 'pages',
        ];
    }

    /**
     * Apply the `keystone.seo.sitemap.entries` plugin filter over the
     * current rows. Runs before the visibility pass; see the class docblock.
     */
    protected function applyEntriesFilter(): void
    {
        if (! function_exists('applyFilters')) {
            return;
        }

        try {
            $rows = SitemapEntry::query()->get();
        } catch (Throwable) {
            return;
        }

        if ($rows->isEmpty()) {
            return;
        }

        $original = $rows->map(fn (SitemapEntry $entry): array => [
            'url'           => (string) $entry->url,
            'type'          => (string) $entry->type,
            'is_indexable'  => (bool) $entry->is_indexable,
            'priority'      => (float) $entry->priority,
            'changefreq'    => (string) $entry->changefreq,
            'last_modified' => optional($entry->last_modified)?->toIso8601String(),
        ])->all();

        /** @var array<int, array<string, mixed>> $filtered */
        $filtered = applyFilters('keystone.seo.sitemap.entries', $original);

        if (! is_array($filtered) || $filtered === $original) {
            return;
        }

        $originalByUrl = collect($original)->keyBy('url');
        $filteredByUrl = collect($filtered)
            ->filter(fn ($row): bool => is_array($row) && isset($row['url']) && is_string($row['url']))
            ->keyBy('url');

        // Rows dropped from the filter output: hide them from the
        // vendor generator by flipping the indexable flag. Preserves
        // the polymorphic FK so a later un-hide restores the same row.
        foreach ($originalByUrl->keys() as $url) {
            if (! $filteredByUrl->has($url)) {
                SitemapEntry::query()->where('url', $url)->update(['is_indexable' => false]);
            }
        }

        // Rows still present after filtering: apply per-row changes to
        // is_indexable / priority / changefreq / type / last_modified.
        // Ignore attempts to mutate `url` (that would break the join)
        // and any plugin-added rows without a host model (schema
        // requires the morph FK — documented in the class docblock).
        foreach ($filteredByUrl as $url => $row) {
            if (! $originalByUrl->has($url)) {
                continue;
            }

            $updates = [];

            foreach (['is_indexable', 'priority', 'changefreq', 'type'] as $column) {
                if (array_key_exists($column, $row) && $row[$column] !== $originalByUrl[$url][$column]) {
                    $updates[$column] = $row[$column];
                }
            }

            if (array_key_exists('last_modified', $row)) {
                $normalized = self::normalizeLastModified($row['last_modified']);

                if ($normalized !== $originalByUrl[$url]['last_modified']) {
                    $updates['last_modified'] = $normalized;
                }
            }

            if ([] !== $updates) {
                SitemapEntry::query()->where('url', $url)->update($updates);
            }
        }
    }

    /**
     * Coerce a filter subscriber's `last_modified` value back to the
     * ISO-8601 shape the reconciler snapshotted, so the equality check
     * against the pre-filter row doesn't false-positive on a
     * `DateTimeInterface` vs string mismatch.
     */
    protected static function normalizeLastModified(mixed $value): ?string
    {
        if (null === $value) {
            return null;
        }

        if ($value instanceof DateTimeInterface) {
            return CarbonImmutable::instance($value)->toIso8601String();
        }

        $value = (string) $value;

        if ('' === $value) {
            return null;
        }

        try {
            return CarbonImmutable::parse($value)->toIso8601String();
        } catch (Throwable) {
            // Unparseable input — leave the row untouched by returning
            // the original snapshot value so the != check treats it as
            // "no change" rather than writing garbage.
            return $value;
        }
    }
}
