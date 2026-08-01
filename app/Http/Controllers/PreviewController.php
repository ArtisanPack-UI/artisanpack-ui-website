<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Post;
use ArtisanPackUI\CMSFramework\Modules\Pages\Models\Page;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Signed-URL preview endpoint for drafts, scheduled, and published
 * records. Reachable via `/preview/{type}/{id}?...&signature=...` — the
 * `signed` route middleware verifies the HMAC + expiration timestamp
 * before the request lands here, so an unauthenticated user with a
 * valid link can view the record while an invalid/expired signature
 * gets a 403.
 *
 * The response is rendered through the active theme by delegating to
 * the same `renderPage`/`renderPost` methods the public routes use —
 * a preview is what the record will look like once live. The only
 * material difference is (a) status is ignored during the lookup and
 * (b) the response carries `X-Robots-Tag: noindex, nofollow` so
 * crawlers can't index preview URLs even if a link is accidentally
 * shared beyond the intended reviewer.
 */
class PreviewController extends Controller
{
    public function __construct(
        private readonly PublicPageController $publicPage,
        private readonly BlogController $blog,
    ) {}

    public function __invoke(Request $request, string $type, int $id): SymfonyResponse
    {
        $response = $this->renderFor($request, $type, $id);

        // Stamp `noindex, nofollow` so a leaked preview link can't
        // surface in search results even if crawled directly.
        $response->headers->set('X-Robots-Tag', 'noindex, nofollow');

        // And keep it out of shared caches. This route deliberately sits
        // outside `site.access` and renders unpublished content to anyone
        // holding the signed link, so a CDN or corporate proxy that stored
        // the response could hand a draft to a visitor who has no link at
        // all — the one way preview content escapes the signature
        // entirely. `renderPost()` already suppresses the `Cache-Tag`
        // header for previews; this closes the other half.
        $response->headers->set('Cache-Control', 'private, no-store, max-age=0');

        return $response;
    }

    private function renderFor(Request $request, string $type, int $id): SymfonyResponse
    {
        return match ($type) {
            'post'  => $this->renderPost($request, $id),
            'page'  => $this->renderPage($id),
            default => throw new NotFoundHttpException,
        };
    }

    private function renderPost(Request $request, int $id): SymfonyResponse
    {
        // Mirror the `feature:blog` middleware that gates public blog
        // routes: when the blog feature is off the public /blog/*
        // surface 404s, so a previously-issued signed preview URL for
        // a post must 404 too — otherwise disabling the feature leaves
        // an unauthenticated read path open through any preview link
        // an admin minted while it was on. Admin-role visitors bypass
        // so the maintainer can still preview posts for debugging when
        // the feature is off, matching {@see EnsureFeatureIsEnabled}.
        $this->assertBlogAccessible($request);

        $post = Post::query()->whereKey($id)->first();

        if (null === $post) {
            throw new NotFoundHttpException;
        }

        // Pass `isPreview: true` so BlogController skips the public
        // render actions AND the Cache-Tag header — see the doc block
        // on renderPost() for the full rationale.
        return $this->blog->renderPost($post, isPreview: true);
    }

    private function assertBlogAccessible(Request $request): void
    {
        $user = $request->user();

        if (null !== $user) {
            $adminRole = (string) keystone('admin_role', 'admin');

            if (method_exists($user, 'hasRole') && $user->hasRole($adminRole)) {
                return;
            }
        }

        if (! (bool) keystone('features.blog', false)) {
            throw new NotFoundHttpException;
        }
    }

    private function renderPage(int $id): SymfonyResponse
    {
        $page = Page::query()->whereKey($id)->first();

        if (null === $page) {
            throw new NotFoundHttpException;
        }

        // renderPage() returns a View; render it to string so we can
        // attach the noindex header on the wrapping Response. Preview
        // flag suppresses the public render actions (analytics, cache
        // warm, view counters would otherwise fire on preview clicks).
        $view = $this->publicPage->renderPage($page, isPreview: true);

        return response($view->render());
    }
}
