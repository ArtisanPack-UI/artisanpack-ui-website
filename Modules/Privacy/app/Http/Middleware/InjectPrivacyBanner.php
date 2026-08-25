<?php

declare(strict_types=1);

namespace Modules\Privacy\Http\Middleware;

use Closure;
use Illuminate\Foundation\Vite;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Auto-inject the Keystone cookie banner into every public HTML response.
 *
 * The banner mount is emitted outside the theme layer so every site picks
 * it up regardless of the active theme — themes never opt in. Injection
 * only fires when:
 *   - the response is 2xx HTML with a `</body>` tag to splice before,
 *   - the request is a normal browser GET (not JSON / not admin / not
 *     Inertia partial reload, since Inertia's admin surface has its own
 *     banner-suppression semantics),
 *   - the request path is not under `/admin`, `/api`, `/auth`, `/install`,
 *     `/site-password`, `/site-editor`, `/visual-editor` — the banner is
 *     for public visitors only.
 *
 * The injected snippet is a `<div>` mount + the built `keystone-privacy-
 * island` Vite entry. The island reads the theme's `--wp--preset--color--*`
 * variables through `resources/css/keystone-privacy-island.css` so the
 * banner inherits the active theme's palette out of the box.
 */
class InjectPrivacyBanner
{
    /**
     * Path prefixes that opt out of the auto-injected banner. Admin and
     * install surfaces don't need a public visitor's consent prompt; API,
     * asset, and machine-facing paths have no HTML to inject into.
     *
     * @var list<string>
     */
    private const SUPPRESSED_PREFIXES = [
        'admin',
        'api',
        'auth',
        'install',
        'site-password',
        'site-editor',
        'visual-editor',
        'themes',
        'storage',
        'build',
        'assets',
        'up',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $this->shouldInject($request, $response)) {
            return $response;
        }

        $content = (string) $response->getContent();
        $needle  = '</body>';

        // Splice before the LAST `</body>` occurrence — a body-tag literal
        // can legally show up in a `<textarea>`, a code snippet, a
        // `<template>`, or an HTML-in-comment block, and a naive
        // `str_replace` would inject the banner at every hit. The document's
        // actual closer is always the last one.
        $position = strrpos($content, $needle);

        if (false === $position) {
            return $response;
        }

        $snippet = $this->buildSnippet();
        $patched = substr_replace($content, $snippet."\n".$needle, $position, strlen($needle));

        // Preserve the original renderable (usually a View for Inertia)
        // across setContent. Laravel's Illuminate\Http\Response::setContent
        // overwrites $response->original with whatever is passed in, and
        // TestResponse::assertViewHas / viewData both read $response->original
        // to get the source View. Overwriting it with a raw string breaks
        // every Inertia test asserting via assertInertia() on responses that
        // pass through this middleware.
        $original = $response instanceof \Illuminate\Http\Response ? $response->getOriginalContent() : null;
        $response->setContent($patched);

        if (null !== $original && $response instanceof \Illuminate\Http\Response) {
            $response->original = $original;
        }

        return $response;
    }

    /**
     * Build the mount + script-tag pair inline.
     *
     * The banner ships as a Vite entry (`resources/js/keystone-privacy-
     * island.tsx`). Rendering the Vite tags in code (rather than through a
     * Blade partial that runs `@vite(...)`) lets the middleware degrade
     * gracefully when the manifest isn't built yet — in that case we still
     * emit the mount `<div>` so pages don't lose the anchor. When the app
     * IS built the tags render exactly like `@vite()` would.
     */
    private function buildSnippet(): string
    {
        $mount = '<div id="keystone-privacy-banner-root"></div>';

        try {
            $vite = app(Vite::class);
            $tags = (string) $vite(['resources/js/keystone-privacy-island.tsx']);
        } catch (Throwable) {
            return $mount;
        }

        return $mount."\n".$tags;
    }

    /**
     * Deciders kept separate from `handle()` so tests can pin exactly
     * which axis suppressed the injection.
     */
    private function shouldInject(Request $request, Response $response): bool
    {
        if (true !== (bool) config('artisanpack.privacy.enabled', true)) {
            return false;
        }

        if (2 !== (int) ($response->getStatusCode() / 100)) {
            return false;
        }

        if (! $request->isMethod('GET')) {
            return false;
        }

        if ($request->header('X-Inertia')) {
            // Inertia partial-reload / JSON envelope — no HTML to splice.
            return false;
        }

        $contentType = (string) $response->headers->get('Content-Type', '');

        if ('' !== $contentType && ! str_contains(strtolower($contentType), 'text/html')) {
            return false;
        }

        $path = trim($request->path(), '/');

        if ('' === $path) {
            return true;
        }

        $firstSegment = explode('/', $path)[0];

        return ! in_array($firstSegment, self::SUPPRESSED_PREFIXES, true);
    }
}
