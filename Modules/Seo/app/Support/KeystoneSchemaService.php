<?php

declare(strict_types=1);

namespace Modules\Seo\Support;

use ArtisanPackUI\MediaLibrary\Models\Media;
use ArtisanPackUI\SEO\Models\SeoMeta;
use ArtisanPackUI\SEO\Services\SchemaService;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;

/**
 * Keystone-flavored Schema.org renderer.
 *
 * The upstream `SchemaService::extractModelData()` reads
 * `$model->featured_image` for the schema's `image` field. On
 * cms-framework Page / Post that hits the broken `HasFeaturedImage`
 * trait's MorphOne::withTimestamps(). See
 * [[seo-keystone-social-meta-service]] for the same fix on
 * `SocialMetaService`.
 *
 * We can't call `parent::extractModelData()` because it crashes on
 * the `featured_image` access before we can patch the result — so the
 * method is duplicated here with the safe image path. The rest of the
 * payload (name, description, dates, author) is identical to upstream;
 * keep them in sync when bumping the SEO package version.
 */
class KeystoneSchemaService extends SchemaService
{
    protected function extractModelData(Model $model, ?SeoMeta $seoMeta): array
    {
        $data = [];

        $data['name']        = $seoMeta?->meta_title ?? $model->title ?? $model->name ?? '';
        $data['description'] = $seoMeta?->meta_description ?? $model->excerpt ?? $model->description ?? '';

        if (method_exists($model, 'getUrl')) {
            $data['url'] = $model->getUrl();
        } elseif (isset($model->slug)) {
            $data['url'] = url($model->slug);
        }

        $data['image'] = $seoMeta?->getEffectiveOgImage()
            ?? $this->resolveFeaturedImageUrl($model);

        if (isset($model->created_at) && $model->created_at instanceof DateTimeInterface) {
            $data['dateCreated'] = $model->created_at->toIso8601String();
        }
        if (isset($model->published_at) && $model->published_at instanceof DateTimeInterface) {
            $data['datePublished'] = $model->published_at->toIso8601String();
        }
        if (isset($model->updated_at) && $model->updated_at instanceof DateTimeInterface) {
            $data['dateModified'] = $model->updated_at->toIso8601String();
        }

        if (isset($model->author) && null !== $model->author) {
            $data['author'] = [
                'name' => $model->author->name ?? '',
                'url'  => method_exists($model->author, 'getUrl') ? $model->author->getUrl() : null,
            ];
        }

        if (null !== $seoMeta?->schema_markup && is_array($seoMeta->schema_markup)) {
            $data = array_merge($data, $seoMeta->schema_markup);
        }

        $filtered = applyFilters('keystone.seo.schema.data', $data, $model, $seoMeta);

        // Guarded: a subscriber returning a non-array would throw at
        // the sink and blank the head-rendered JSON-LD. Fall back to
        // the pre-filter data on invalid output.
        /** @var array<string, mixed> $result */
        $result = is_array($filtered) ? $filtered : $data;

        return $result;
    }

    /**
     * Same logic as KeystoneSocialMetaService::resolveFeaturedImageUrl;
     * duplicated here because we don't want a cross-class dependency
     * between two unrelated SEO subclasses just to share five lines.
     */
    protected function resolveFeaturedImageUrl(Model $model): ?string
    {
        if (! isset($model->featured_image_id) || null === $model->featured_image_id) {
            return null;
        }

        if (! class_exists(Media::class)) {
            return null;
        }

        // Prefer the already-loaded relation to avoid an N+1 from inside
        // the head-meta render. Eager-load `featuredImageMedia` on the
        // model the controller passes to the SEO Blade components for the
        // fast path; the Media::find() fallback covers the rare case
        // where it wasn't loaded.
        if ($model->relationLoaded('featuredImageMedia')) {
            $relation = $model->getRelation('featuredImageMedia');

            return null === $relation ? null : (string) $relation->url();
        }

        $media = Media::query()->find((int) $model->featured_image_id);

        return null === $media ? null : (string) $media->url();
    }
}
