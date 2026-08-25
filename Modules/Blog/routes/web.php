<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Blog\Http\Controllers\BlogController;
use Modules\Blog\Http\Controllers\CommentSubmissionController;

/*
|--------------------------------------------------------------------------
| Blog Public Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Blog\Providers\RouteServiceProvider`, which wraps this
| file in the `web` middleware group the central `routes/web.php` supplied
| implicitly via `withRouting(web: ...)`. Names and URIs are unchanged from that
| file — see plans/14-modular-laravel-setup.md §3.3.
|
| The `feature:blog` + `site.access` group is transcribed from the central file
| verbatim; the per-route `throttle:comments` on the submission endpoint stays
| next to the route it guards.
|
| `/blog/{slug}` is only the hardcoded fallback post URL. Posts also resolve at
| their configured permalink through the central `/{path}` catch-all, which
| hands the resolved post back to `BlogController::renderPost()` — so that
| catch-all is a collaborator of this module, not merely an obstacle to it.
|
| Reachability, though, is entirely down to the catch-all's path constraint.
| Module routes register *after* everything in `routes/web.php`, and `{path}`'s
| `.+` pattern matches slashes, so `blog` and `blog/{slug}` are kept off it by
| the `blog($|/)` alternative already present there — not by ordering (§3.3).
| That alternative predates this extraction and needs no change.
|
| `comments` is deliberately *not* added to that constraint, matching the call
| #207 made for `logout` and `email/verification-notification`: the catch-all
| only answers GET, so a POST-only URI cannot be shadowed, and reserving
| `comments` would newly 404 a CMS page at that slug. `BlogRoutesTest` pins
| both halves.
|
*/

Route::middleware(['feature:blog', 'site.access'])->group(function (): void {
    Route::get('blog', [BlogController::class, 'index'])->name('blog.index');
    Route::get('blog/{slug}', [BlogController::class, 'show'])->name('blog.show');

    // Comment submissions from the visual-editor's
    // `artisanpack/post-comments-form` block. Throttled via the
    // cms-framework `comments` rate limiter so guests can't spam.
    Route::post('comments', [CommentSubmissionController::class, 'store'])
        ->middleware('throttle:comments')
        ->name('comments.store');
});
