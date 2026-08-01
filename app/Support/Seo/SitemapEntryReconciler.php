<?php

declare(strict_types=1);

namespace App\Support\Seo;

use ArtisanPackUI\SEO\Models\SitemapEntry;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Throwable;

/**
 * Applies the Keystone `keystone.seo.sitemap.entries` filter over the
 * `sitemap_entries` table before the vendor SEO package regenerates the
 * XML output.
 *
 * The table is populated by {@see \ArtisanPackUI\SEO\Observers\SitemapObserver}
 * from every Page / Post save. Plugin authors sometimes need to hide a
 * URL from the sitemap without touching the underlying model (a staging
 * page, a plugin-owned resource whose canonical lives elsewhere) —
 * the filter is the shared extension seam.
 *
 * Contract: subscribers receive the current entries as an array of
 * `{url, type, is_indexable, priority, changefreq, last_modified}`
 * associative arrays and return the (possibly-mutated) list.
 *
 * The reconciler operates only on the `is_indexable` and per-row
 * priority/changefreq/type/last_modified columns — it never inserts or
 * deletes rows, because the vendor schema requires a polymorphic FK on
 * every row (`sitemapable_type` + `sitemapable_id` are NOT NULL) and a
 * plugin-owned URL has no host model to point to. To hide an entry,
 * subscribers omit it from the returned list; the reconciler flips
 * `is_indexable=false` on the row so vendor's `SitemapEntry::indexable()`
 * scope skips it during XML generation.
 *
 * Fresh installs where `sitemap_entries` doesn't exist yet no-op —
 * the filter is bypassed rather than throwing so the caller (usually
 * {@see \App\Installer\InstallationService::generateSitemap()}) can
 * continue.
 */
class SitemapEntryReconciler
{
    public function apply(): void
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
