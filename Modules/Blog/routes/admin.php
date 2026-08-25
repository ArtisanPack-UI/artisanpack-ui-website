<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Blog\Http\Controllers\PostCategoryController;
use Modules\Blog\Http\Controllers\PostController;
use Modules\Blog\Http\Controllers\PostTagController;

/*
|--------------------------------------------------------------------------
| Blog Admin Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Blog\Providers\RouteServiceProvider`, which wraps this
| file in the shared admin group (`web` + auth/2FA stack, `admin` prefix,
| `admin.` name prefix). Names and URIs are unchanged from the central
| `routes/admin.php` these were extracted from — see
| plans/14-modular-laravel-setup.md §3.3.
|
| Both gates below wrapped these routes in the central file — the outer
| `role:admin,site_owner,editor` group they shared with the pages resource, and
| the inner `feature:blog` group — reapplied here in the same order so the
| middleware stack `route:list` reports is identical.
|
*/

Route::middleware(['role:admin,site_owner,editor', 'feature:blog'])->group(function (): void {
    Route::post('posts/{post}/duplicate', [PostController::class, 'duplicate'])->name('posts.duplicate');
    Route::post('posts/quick-create', [PostController::class, 'quickCreate'])->name('posts.quick-create');
    // Throttled for the same reason as the pages preview in the central
    // file: the client debounces at 500ms, so a human typing stays far
    // under 60/min, but the endpoint is cheap enough to call in a loop
    // that it needs a ceiling of its own.
    Route::post('posts/slug-preview', [PostController::class, 'slugPreview'])
        ->middleware('throttle:60,1')
        ->name('posts.slug-preview');

    // Taxonomy resources are registered *before* the catch-all `posts`
    // resource so `/admin/posts/categories` and `/admin/posts/tags` do not
    // collide with `posts/{post}/edit` route binding. That ordering is
    // intra-file and so survives the extraction unchanged;
    // `BlogRoutesTest` pins it through the router's own matcher, which is the
    // only thing that sees it.
    Route::resource('posts/categories', PostCategoryController::class)
        ->parameters(['categories' => 'category'])
        ->names('posts.categories')
        ->except(['show', 'create']);
    Route::resource('posts/tags', PostTagController::class)
        ->parameters(['tags' => 'tag'])
        ->names('posts.tags')
        ->except(['show', 'create']);

    Route::resource('posts', PostController::class)->except(['show', 'create']);
});
