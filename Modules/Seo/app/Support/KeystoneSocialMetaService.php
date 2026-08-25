<?php

declare(strict_types=1);

namespace Modules\Seo\Support;

use ArtisanPackUI\MediaLibrary\Models\Media;
use ArtisanPackUI\SEO\DTOs\OpenGraphDTO;
use ArtisanPackUI\SEO\DTOs\TwitterCardDTO;
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
    /**
     * Filter the generated Open Graph DTO through the Keystone
     * `keystone.seo.social.payload` filter chain so plugin authors
     * can rewrite / add fields before the tags render.
     *
     * The filter receives an associative array of the DTO's public
     * fields plus a `{kind: 'openGraph'}` context marker so a single
     * subscriber can distinguish the two social payloads without
     * having to bind twice.
     */
    public function generateOpenGraph(Model $model, ?SeoMeta $seoMeta = null): OpenGraphDTO
    {
        $dto = parent::generateOpenGraph($model, $seoMeta);

        /** @var array<string, mixed> $filtered */
        $filtered = applyFilters(
            'keystone.seo.social.payload',
            $this->openGraphToArray($dto),
            ['kind' => 'openGraph', 'model' => $model, 'seoMeta' => $seoMeta],
        );

        return $this->openGraphFromArray($filtered);
    }

    /**
     * Filter the generated Twitter Card DTO through the same
     * `keystone.seo.social.payload` filter chain. Context marker
     * `{kind: 'twitterCard'}` keeps subscribers side-effect free
     * across the two DTOs.
     */
    public function generateTwitterCard(Model $model, ?SeoMeta $seoMeta = null): TwitterCardDTO
    {
        $dto = parent::generateTwitterCard($model, $seoMeta);

        /** @var array<string, mixed> $filtered */
        $filtered = applyFilters(
            'keystone.seo.social.payload',
            $this->twitterCardToArray($dto),
            ['kind' => 'twitterCard', 'model' => $model, 'seoMeta' => $seoMeta],
        );

        return $this->twitterCardFromArray($filtered);
    }

    /**
     * Flatten the OG DTO to a plain associative array without the
     * `og:` prefix — subscribers work with `title`, `description`,
     * `image`, etc.
     *
     * @return array<string, mixed>
     */
    protected function openGraphToArray(OpenGraphDTO $dto): array
    {
        return [
            'title'       => $dto->title,
            'description' => $dto->description,
            'image'       => $dto->image,
            'url'         => $dto->url,
            'type'        => $dto->type,
            'siteName'    => $dto->siteName,
            'locale'      => $dto->locale,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function openGraphFromArray(array $data): OpenGraphDTO
    {
        return new OpenGraphDTO(
            title: (string) ($data['title'] ?? ''),
            description: self::nullableStringField($data['description'] ?? null),
            image: self::nullableStringField($data['image'] ?? null),
            url: (string) ($data['url'] ?? ''),
            type: (string) ($data['type'] ?? 'website'),
            siteName: (string) ($data['siteName'] ?? ''),
            locale: (string) ($data['locale'] ?? 'en_US'),
        );
    }

    /**
     * @return array<string, mixed>
     */
    protected function twitterCardToArray(TwitterCardDTO $dto): array
    {
        return [
            'card'        => $dto->card,
            'title'       => $dto->title,
            'description' => $dto->description,
            'image'       => $dto->image,
            'site'        => $dto->site,
            'creator'     => $dto->creator,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function twitterCardFromArray(array $data): TwitterCardDTO
    {
        return new TwitterCardDTO(
            card: (string) ($data['card'] ?? 'summary_large_image'),
            title: (string) ($data['title'] ?? ''),
            description: self::nullableStringField($data['description'] ?? null),
            image: self::nullableStringField($data['image'] ?? null),
            site: self::nullableStringField($data['site'] ?? null),
            creator: self::nullableStringField($data['creator'] ?? null),
        );
    }

    /**
     * Coerce a filter subscriber's value back to a nullable string.
     * Empty strings collapse to null so downstream `toArrayFiltered()`
     * treats "" and null the same as the DTO's null default.
     */
    protected static function nullableStringField(mixed $value): ?string
    {
        if (null === $value) {
            return null;
        }

        $value = (string) $value;

        return '' === $value ? null : $value;
    }

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
