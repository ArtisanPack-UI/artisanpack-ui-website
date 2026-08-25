<?php

declare(strict_types=1);

namespace Modules\SiteEditor\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Serves the visual-editor package's prebuilt SPA assets with the
 * `Access-Control-Allow-Origin: *` header needed by Gutenberg's iframe
 * canvas.
 *
 * Why this exists: the editor canvas is a sandboxed iframe with a
 * `null` origin. When it imports module chunks (e.g.
 * `/visual-editor/chunks/site-editor-app-*.js`) the browser requires
 * CORS headers on the response — nginx serving the file directly from
 * `public/` doesn't emit them, so the iframe sees a CORS error and the
 * editor never finishes mounting.
 *
 * Routing through Laravel adds the header at the cost of running PHP
 * per asset request. That's fine for dev (where the alternative is
 * shipping per-developer nginx config); for production the right
 * answer is a build-time copy + a server-level CORS header on the
 * static path.
 *
 * The assets live at `vendor/artisanpack-ui/visual-editor/dist/editor/`
 * — that's the prebuilt app-mode bundle the package ships with `base:
 * '/visual-editor/'` so absolute chunk URLs resolve correctly under
 * this controller's path. The consumer this serves is Keystone's own
 * override of the package blade,
 * `resources/views/vendor/visual-editor/site-editor/index.blade.php`,
 * which loads `asset('visual-editor/site-editor.js')` rather than the
 * package's `@vite()` line — that Vite entry lives in the package repo
 * and does not exist in a consumer app.
 *
 * Version floor (#157). `dist/` used to be a purely local build
 * artefact: `.gitignore` excluded it and the package's release workflow
 * threw it away, so Composer installs of 1.5.0–1.5.2 landed a vendor
 * tree with no `dist/editor/` at all and every request here 404'd.
 * Upstream #678 started baking `dist/editor/` + `dist/lib/` into the
 * tarball and #683 fixed the tag race that stopped #678 reaching
 * Packagist, making 1.5.3 the first release that actually ships them.
 * The root `composer.json` therefore has to keep a floor of at least
 * 1.5.3 on `artisanpack-ui/visual-editor`; `VisualEditorAssetTest`
 * pins both that floor and the presence of the vendored tree so a
 * downgrade fails the suite with a readable reason instead of a 404.
 *
 * An absent dist tree is logged rather than 404'd silently: it means the
 * install is broken, not that one asset is missing, and the bare 404 it
 * used to produce took #157 a release cycle to trace back to the
 * package version.
 */
class VisualEditorAssetController extends Controller
{
    /**
     * The prebuilt app-mode bundle inside the installed package, relative
     * to the project root.
     */
    public const DIST_PATH = 'vendor/artisanpack-ui/visual-editor/dist/editor';

    /**
     * Mime type lookup for the asset extensions the prebuilt site
     * editor emits. Keeping this list explicit (rather than relying on
     * Symfony's MIME guesser) means an unexpected extension serves as
     * `application/octet-stream` and never as `text/html` — which
     * would risk script injection if a future build emitted unexpected
     * filenames.
     */
    protected const MIME_TYPES = [
        'js'    => 'application/javascript',
        'mjs'   => 'application/javascript',
        'map'   => 'application/json',
        'css'   => 'text/css',
        'json'  => 'application/json',
        'svg'   => 'image/svg+xml',
        'png'   => 'image/png',
        'jpg'   => 'image/jpeg',
        'jpeg'  => 'image/jpeg',
        'gif'   => 'image/gif',
        'woff'  => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf'   => 'font/ttf',
        'otf'   => 'font/otf',
    ];

    public function __invoke(Request $request, string $path): BinaryFileResponse
    {
        $base = realpath(base_path(self::DIST_PATH));

        if (false === $base) {
            Log::warning('Visual-editor asset request could not be served: the installed artisanpack-ui/visual-editor package has no '.self::DIST_PATH.' directory. Releases before 1.5.3 did not ship one — check the version floor in composer.json and re-run composer update.', [
                'path' => $path,
            ]);

            abort(404);
        }

        $target = realpath($base.'/'.$path);

        // Reject path traversal: realpath() resolved to a path that
        // escapes the dist directory, or returned false (file missing).
        if (false === $target || ! str_starts_with($target, $base.DIRECTORY_SEPARATOR) && $target !== $base) {
            abort(404);
        }

        $extension = strtolower(pathinfo($target, PATHINFO_EXTENSION));
        $mime      = self::MIME_TYPES[$extension] ?? 'application/octet-stream';

        $response = response()->file($target, [
            'Access-Control-Allow-Origin' => '*',
            'Content-Type'                => $mime,
        ]);

        // Conditional caching: browsers always revalidate, server returns
        // 304 when mtime+size are unchanged. This was previously
        // `max-age=3600`, which baked stale editor chunks into browser
        // caches for an hour after every package rebuild — making
        // iterative development on the symlinked package painful (see
        // visual-editor docs/plans/515-custom-hex-state-routing.md).
        $response->setAutoEtag();
        $response->setAutoLastModified();
        $response->headers->set('Cache-Control', 'public, max-age=0, must-revalidate');
        $response->isNotModified($request);

        return $response;
    }
}
