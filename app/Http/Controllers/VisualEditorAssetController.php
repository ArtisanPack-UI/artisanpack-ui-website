<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\Request;
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
 * static path. Tracked as a known follow-up against the visual-editor
 * package: it should ship a `vendor:publish` mechanism that copies the
 * dist into a CORS-aware public path.
 *
 * The assets live at `vendor/artisanpack-ui/visual-editor/dist/editor/`
 * — that's the prebuilt app-mode bundle the package ships with `base:
 * '/visual-editor/'` so absolute chunk URLs resolve correctly under
 * this controller's path.
 */
class VisualEditorAssetController extends Controller
{
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
        $base = realpath(base_path('vendor/artisanpack-ui/visual-editor/dist/editor'));

        abort_if(false === $base, 404);

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
