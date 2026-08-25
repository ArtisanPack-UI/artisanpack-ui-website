<?php

declare(strict_types=1);

namespace Modules\Seo\Support;

use App\Support\Hooks;
use ArtisanPackUI\MediaLibrary\Models\Media;
use ArtisanPackUI\SEO\Models\SeoMeta;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rules\Exists;
use Modules\Media\Support\ImageMediaRule;
use Throwable;

/**
 * Helpers shared by the admin Page / Post edit screens for loading the
 * SEO meta payload, validating user input, and persisting it back to
 * `seo_meta`. Keeps the SEO field surface in lockstep across content
 * types instead of duplicating the field list in each controller.
 */
class SeoMetaSupport
{
    /**
     * Validation rules for the SEO subset of the page/post edit form. All
     * fields are nullable so existing edit screens keep working when
     * nothing is filled in.
     *
     * @return array<string, array<int, Exists|string>>
     */
    public static function rules(): array
    {
        return [
            'seo'                       => ['nullable', 'array'],
            'seo.meta_title'            => ['nullable', 'string', 'max:255'],
            'seo.meta_description'      => ['nullable', 'string', 'max:1000'],
            'seo.canonical_url'         => ['nullable', 'string', 'max:500', 'url'],
            'seo.no_index'              => ['nullable', 'boolean'],
            'seo.no_follow'             => ['nullable', 'boolean'],
            'seo.focus_keyword'         => ['nullable', 'string', 'max:255'],
            'seo.og_title'              => ['nullable', 'string', 'max:255'],
            'seo.og_description'        => ['nullable', 'string', 'max:1000'],
            'seo.og_image_id'           => ImageMediaRule::nullable(),
            'seo.twitter_card'          => ['nullable', 'string', 'in:summary,summary_large_image,app,player'],
            'seo.twitter_title'         => ['nullable', 'string', 'max:255'],
            'seo.twitter_description'   => ['nullable', 'string', 'max:1000'],
            'seo.twitter_image_id'      => ImageMediaRule::nullable(),
            'seo.schema_type'           => ['nullable', 'string', 'max:100'],
            'seo.sitemap_priority'      => ['nullable', 'numeric', 'between:0,1'],
            'seo.sitemap_changefreq'    => ['nullable', 'string', 'in:always,hourly,daily,weekly,monthly,yearly,never'],
            'seo.exclude_from_sitemap'  => ['nullable', 'boolean'],
        ];
    }

    /**
     * Build the JSON payload the admin Edit screens render for the SEO
     * card. Pulls from the persisted `seo_meta` row when present; falls
     * back to sane defaults so the form has stable shape for fresh
     * content.
     *
     * Image IDs are paired with the media-library URL so the picker can
     * hydrate without an extra round-trip.
     *
     * @return array<string, mixed>
     */
    public static function payload(Model $model): array
    {
        $seo = SeoMeta::query()
            ->where('seoable_type', $model->getMorphClass())
            ->where('seoable_id', $model->getKey())
            ->first();

        $payload = [
            'meta_title'           => $seo?->meta_title ?? '',
            'meta_description'     => $seo?->meta_description ?? '',
            'canonical_url'        => $seo?->canonical_url ?? '',
            'no_index'             => (bool) ($seo?->no_index ?? false),
            'no_follow'            => (bool) ($seo?->no_follow ?? false),
            'focus_keyword'        => $seo?->focus_keyword ?? '',
            'og_title'             => $seo?->og_title ?? '',
            'og_description'       => $seo?->og_description ?? '',
            'og_image'             => self::mediaPayload($seo?->og_image_id),
            'twitter_card'         => $seo?->twitter_card ?? 'summary_large_image',
            'twitter_title'        => $seo?->twitter_title ?? '',
            'twitter_description'  => $seo?->twitter_description ?? '',
            'twitter_image'        => self::mediaPayload($seo?->twitter_image_id),
            'schema_type'          => $seo?->schema_type ?? '',
            'sitemap_priority'     => (float) ($seo?->sitemap_priority ?? 0.5),
            'sitemap_changefreq'   => $seo?->sitemap_changefreq ?? 'weekly',
            'exclude_from_sitemap' => (bool) ($seo?->exclude_from_sitemap ?? false),
        ];

        $filtered = applyFilters('keystone.seo.meta.payload', $payload, $model, $seo);

        // Guarded: a subscriber returning a non-array (accident or plugin
        // bug) would throw a TypeError at the sink and crash every edit
        // screen. Fall back to the pre-filter payload — matches the
        // "untrusted plugin output" posture in SitemapEntryReconciler.
        /** @var array<string, mixed> $result */
        $result = is_array($filtered) ? $filtered : $payload;

        return $result;
    }

    /**
     * Persist the validated SEO payload to `seo_meta` for the given
     * model. An empty / no-op payload (all nulls + default sitemap
     * settings) deletes the row so we don't accumulate empty records.
     *
     * @param  array<string, mixed>  $input  Validated input from the
     *                                       admin edit form (the
     *                                       `'seo'` array, or `null`
     *                                       when the section is hidden).
     */
    public static function save(Model $model, ?array $input): void
    {
        $input = $input ?? [];

        $data = [
            'meta_title'           => self::nullableString($input['meta_title'] ?? null),
            'meta_description'     => self::nullableString($input['meta_description'] ?? null),
            'canonical_url'        => self::nullableString($input['canonical_url'] ?? null),
            'no_index'             => (bool) ($input['no_index'] ?? false),
            'no_follow'            => (bool) ($input['no_follow'] ?? false),
            'focus_keyword'        => self::nullableString($input['focus_keyword'] ?? null),
            'og_title'             => self::nullableString($input['og_title'] ?? null),
            'og_description'       => self::nullableString($input['og_description'] ?? null),
            'og_image_id'          => self::nullableInt($input['og_image_id'] ?? null),
            'twitter_card'         => self::nullableString($input['twitter_card'] ?? null) ?? 'summary_large_image',
            'twitter_title'        => self::nullableString($input['twitter_title'] ?? null),
            'twitter_description'  => self::nullableString($input['twitter_description'] ?? null),
            'twitter_image_id'     => self::nullableInt($input['twitter_image_id'] ?? null),
            'schema_type'          => self::nullableString($input['schema_type'] ?? null),
            'sitemap_priority'     => self::numericOr($input['sitemap_priority'] ?? null, 0.5),
            'sitemap_changefreq'   => self::nullableString($input['sitemap_changefreq'] ?? null) ?? 'weekly',
            'exclude_from_sitemap' => (bool) ($input['exclude_from_sitemap'] ?? false),
        ];

        $modelType = $model->getMorphClass();
        $modelId   = $model->getKey();

        if (self::isEmpty($data)) {
            SeoMeta::query()
                ->where('seoable_type', $modelType)
                ->where('seoable_id', $modelId)
                ->delete();

            Hooks::safeDoAction('keystone.admin.seo.meta.updated', $model, null);

            return;
        }

        $seo = SeoMeta::query()->updateOrCreate(
            [
                'seoable_type' => $modelType,
                'seoable_id'   => $modelId,
            ],
            $data,
        );

        Hooks::safeDoAction('keystone.admin.seo.meta.updated', $model, $seo);
    }

    /**
     * Lightweight image record consumed by the React picker. Returns
     * null when no image ID is set or the media row was deleted.
     *
     * @return array{id: int, url: string, title: string|null, alt_text: string|null}|null
     */
    protected static function mediaPayload(?int $mediaId): ?array
    {
        if (null === $mediaId || $mediaId <= 0) {
            return null;
        }

        if (! class_exists(Media::class)) {
            return null;
        }

        try {
            $media = Media::query()->find($mediaId);
        } catch (Throwable) {
            return null;
        }

        if (null === $media) {
            return null;
        }

        return [
            'id'       => (int) $media->id,
            'url'      => (string) $media->url(),
            'title'    => $media->title,
            'alt_text' => $media->alt_text,
        ];
    }

    /**
     * Treat blank strings as null so we don't store whitespace-only
     * values that would defeat the SEO package's fallback chain.
     */
    protected static function nullableString(mixed $value): ?string
    {
        if (null === $value) {
            return null;
        }

        $value = trim((string) $value);

        return '' === $value ? null : $value;
    }

    protected static function nullableInt(mixed $value): ?int
    {
        if (null === $value || '' === $value) {
            return null;
        }

        $int = (int) $value;

        return $int <= 0 ? null : $int;
    }

    protected static function numericOr(mixed $value, float $fallback): float
    {
        if (null === $value || '' === $value || ! is_numeric($value)) {
            return $fallback;
        }

        return (float) $value;
    }

    /**
     * Determine whether the SEO payload would produce a row that has no
     * effect (everything blank, no toggles flipped, priority / changefreq
     * at the schema defaults). Used to clean up `seo_meta` rows when the
     * editor is saved with nothing filled in.
     *
     * @param  array<string, mixed>  $data
     */
    protected static function isEmpty(array $data): bool
    {
        $textFields = [
            'meta_title',
            'meta_description',
            'canonical_url',
            'focus_keyword',
            'og_title',
            'og_description',
            'twitter_title',
            'twitter_description',
            'schema_type',
        ];

        foreach ($textFields as $field) {
            if (null !== $data[$field] && '' !== $data[$field]) {
                return false;
            }
        }

        if (null !== $data['og_image_id'] || null !== $data['twitter_image_id']) {
            return false;
        }

        if (true === $data['no_index'] || true === $data['no_follow'] || true === $data['exclude_from_sitemap']) {
            return false;
        }

        if (0.5 !== (float) $data['sitemap_priority'] || 'weekly' !== $data['sitemap_changefreq']) {
            return false;
        }

        if ('summary_large_image' !== $data['twitter_card']) {
            return false;
        }

        return true;
    }
}
