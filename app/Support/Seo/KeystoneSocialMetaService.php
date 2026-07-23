<?php

declare(strict_types=1);

namespace App\Support\Seo;

use ArtisanPackUI\MediaLibrary\Models\Media;
use ArtisanPackUI\SEO\Models\SeoMeta;
use ArtisanPackUI\SEO\Services\SocialMetaService;
use Illuminate\Database\Eloquent\Model;

/**
 * Keystone-flavored OG / Twitter image resolver.
 *
 * The upstream `SocialMetaService::resolveOgImage()` falls back to
 * `$model->getFeaturedImageUrl()` and `$model->featured_image`. Both of
 * those resolve through the cms-framework `HasFeaturedImage` trait,
 * which builds a `MorphOne` with `->withTimestamps()` — invalid for that
 * relation type and a hard error at render time. See [[hasfeaturedimage-broken]].
 *
 * Keystone's Page + Post models persist a real `featured_image_id` and
 * expose `featuredImageMedia()` (BelongsTo) for it. This override checks
 * that pathway first and falls back to the SEO config defaults, so we
 * sidestep the broken trait entirely without modifying the upstream
 * package.
 */
class KeystoneSocialMetaService extends SocialMetaService
{
    protected function resolveOgImage(Model $model, ?SeoMeta $seoMeta): ?string
    {
        $image = $seoMeta?->getEffectiveOgImage();

        if (null !== $image) {
            return $image;
        }

        $image = $this->resolveFeaturedImageUrl($model);

        if (null !== $image) {
            return $image;
        }

        return config('seo.open_graph.default_image');
    }

    /**
     * Pull the featured image URL via the Keystone-safe path:
     * `featured_image_id` resolved through the media library. Returns
     * null when no image is set or the media row is gone.
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
