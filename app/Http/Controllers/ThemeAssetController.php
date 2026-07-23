<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Serves static assets from a theme directory (`themes/{slug}/…`).
 *
 * Themes live outside `public/` so they're easy to upload as zip
 * archives and so a theme's source files aren't accidentally web-
 * accessible. The Blade renderer needs an HTTP URL for theme
 * stylesheets and images though, so this controller exposes a single
 * gate at `/themes/{theme}/{path}` that:
 *
 *   1. Verifies the theme slug is safe (alphanumeric + hyphens).
 *   2. Resolves the requested file under the theme directory using
 *      `realpath()` and refuses anything that escapes the theme root.
 *   3. Filters to a small allowlist of safe asset extensions — text
 *      and image types only. PHP, HTML, JSON, and anything else
 *      404s, so a malicious theme zip can't smuggle executable
 *      content through this surface.
 */
class ThemeAssetController extends Controller
{
    /**
     * Extensions the controller is willing to serve, paired with a
     * static MIME type. Keeping this list explicit (no Symfony MIME
     * guesser) prevents an unexpected extension from being served as
     * `text/html` and accidentally rendering as a page.
     */
    /**
     * SVG is deliberately excluded — it's an active-content surface
     * (can carry script tags) and first-party hosting of theme-supplied
     * SVG would weaken the no-executable-content guarantee above.
     * Themes that need vector assets should ship them as PNG/WebP for
     * now; a future controller could handle SVG with explicit
     * sanitisation if the need arises.
     */
    protected const MIME_TYPES = [
        'css'   => 'text/css',
        'png'   => 'image/png',
        'jpg'   => 'image/jpeg',
        'jpeg'  => 'image/jpeg',
        'gif'   => 'image/gif',
        'webp'  => 'image/webp',
        'avif'  => 'image/avif',
        'ico'   => 'image/x-icon',
        'woff'  => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf'   => 'font/ttf',
        'otf'   => 'font/otf',
    ];

    public function __invoke(Request $request, string $theme, string $path): BinaryFileResponse
    {
        if (1 !== preg_match('/^[a-z0-9][a-z0-9_\-]*$/i', $theme)) {
            abort(404);
        }

        $themesDir = base_path((string) config('cms.themes.directory', 'themes'));
        $base      = realpath($themesDir.'/'.$theme);

        abort_if(false === $base, 404);

        $target = realpath($base.'/'.$path);

        // Path traversal guard: realpath() either resolved to a path
        // escaping the theme root, or returned false (file missing).
        if (false === $target || (! str_starts_with($target, $base.DIRECTORY_SEPARATOR) && $target !== $base)) {
            abort(404);
        }

        // A theme zip could contain a directory whose name matches an
        // allowed extension (`assets.css/`). `response()->file()` would
        // 500 on a non-regular target; surface 404 instead.
        if (! is_file($target) || ! is_readable($target)) {
            abort(404);
        }

        $extension = strtolower(pathinfo($target, PATHINFO_EXTENSION));

        if (! isset(self::MIME_TYPES[$extension])) {
            abort(404);
        }

        return response()->file($target, [
            'Content-Type'  => self::MIME_TYPES[$extension],
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }
}
