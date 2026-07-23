<?php

/**
 * ArtisanPack UI theme runtime.
 *
 * Extends cms-framework's Theme base class to hook into per-request behavior:
 *   - Enqueue Font Awesome 7 Pro on the front-end AND the editor canvas.
 *   - Enqueue the theme's mobile-menu drawer script on the front-end.
 *   - Register the four custom image sizes the design brief documents.
 *
 * The static theme stylesheet (style.css) is concatenated into
 * `/api/v1/global-styles/css` by cms-framework — no need to enqueue it here.
 * The editor stylesheet (editor.css) is likewise auto-concatenated by
 * cms-framework 2.5.0+.
 *
 * @since 1.0.0
 */

declare(strict_types=1);

namespace Themes\ArtisanpackUi;

use ArtisanPackUI\CMSFramework\Modules\Themes\Contracts\Theme as BaseTheme;

final class Theme extends BaseTheme
{
    /**
     * Font Awesome 7 Pro CSS entrypoint, served from
     * /themes/artisanpack-ui/assets/vendor/fontawesome/css/all.min.css via
     * cms-framework's asset route.
     */
    private const FA_HANDLE = 'artisanpack-ui-fa7';

    private const FA_SRC = 'vendor/fontawesome/css/all.min.css';

    /**
     * Enqueue on the public front-end.
     */
    public function frontendStyles(): array
    {
        return [
            [
                'handle' => self::FA_HANDLE,
                'src' => self::FA_SRC,
                'ver' => '7.3.1',
            ],
        ];
    }

    /**
     * Enqueue in the site-editor canvas iframe so icons render there too.
     */
    public function editorStyles(): array
    {
        return [
            [
                'handle' => self::FA_HANDLE,
                'src' => self::FA_SRC,
                'ver' => '7.3.1',
            ],
        ];
    }

    /**
     * Custom image sizes the design brief documents. Registered before boot()
     * so any code that queries image variants sees the registrations first.
     */
    public function registerImageSizes(): void
    {
        if (! function_exists('apRegisterImageSize')) {
            return;
        }

        apRegisterImageSize('hero-wide', 2400, 900, true);
        apRegisterImageSize('post-cover', 1600, 900, true);
        apRegisterImageSize('package-hero', 1600, 1000, true);
        apRegisterImageSize('card-thumb', 400, 300, true);
    }
}
