<?php

declare(strict_types=1);

namespace App\Support;

use ArtisanPackUI\MediaLibrary\Models\Media;

/**
 * Resolves the configured brand logo (`site.logo_id`) into the shapes the
 * front-end and admin shell need: favicon `<link>` data and a display URL.
 *
 * Centralises the logo lookup so the public theme, the admin root template,
 * and the Inertia shared props all derive their branding from the same
 * source of truth instead of hardcoded assets.
 */
class SiteBranding
{
    /**
     * Favicon `<link>` data derived from the configured logo. Uses a sized
     * variant for raster logos (full resolution is wasteful for an icon) and
     * the original for vector logos, which scale on their own. Returns null
     * when no logo is set or the media is missing / not an image, so callers
     * can fall back to the bundled static favicon.
     *
     * @return array{href: string, type: string, sizes: string}|null
     */
    public static function icon(): ?array
    {
        $media = self::logoMedia();

        if (null === $media) {
            return null;
        }

        $isVector = 'image/svg+xml' === $media->mime_type;

        return [
            'href'  => $isVector ? $media->url() : ($media->imageUrl('thumbnail') ?? $media->url()),
            'type'  => $media->mime_type,
            'sizes' => $isVector ? 'any' : '150x150',
        ];
    }

    /**
     * Display URL for the configured logo, sized for in-page rendering (the
     * admin sidebar mark, the public header). Returns null when no usable
     * logo is configured.
     */
    public static function logoUrl(): ?string
    {
        $media = self::logoMedia();

        if (null === $media) {
            return null;
        }

        if ('image/svg+xml' === $media->mime_type) {
            return $media->url();
        }

        return $media->imageUrl('medium') ?? $media->url();
    }

    /**
     * Resolve `site.logo_id` to its {@see Media} record, or null when unset,
     * missing, or not an image.
     */
    private static function logoMedia(): ?Media
    {
        $logoId = apGetSetting('site.logo_id');

        if (! is_numeric($logoId)) {
            return null;
        }

        $media = Media::find((int) $logoId);

        if (null === $media || ! $media->isImage()) {
            return null;
        }

        return $media;
    }
}
