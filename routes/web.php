<?php

declare(strict_types=1);

use App\Http\Controllers\BlogController;
use App\Http\Controllers\CommentSubmissionController;
use App\Http\Controllers\InstallController;
use App\Http\Controllers\PublicFormController;
use App\Http\Controllers\PublicPageController;
use App\Http\Controllers\SitePasswordController;
use App\Http\Controllers\ThemeAssetController;
use App\Http\Controllers\VisualEditorAssetController;
use Illuminate\Support\Facades\Route;

// One-time install wizard. Gated by `installed:guard` — pre-install requests
// need a valid `?token=` (+ optional IP allowlist) and the absence of the
// `.installed` flag; once installed, every request 404s so the surface
// stops existing entirely. See `plans/06-keystone-plan.md` §5.3.
Route::middleware('installed:guard')->group(function (): void {
    Route::get('install', [InstallController::class, 'show'])->name('install.show');
    Route::post('install', [InstallController::class, 'store'])->name('install.store');
});

Route::get('/', [PublicPageController::class, 'home'])
    ->middleware('site.access')
    ->name('home');

// Shared-password gate screen for the `password-protected` visibility mode.
// Deliberately NOT behind `site.access` so a locked-out visitor can reach it.
Route::get('site-password', [SitePasswordController::class, 'show'])->name('site-password.show');
Route::post('site-password', [SitePasswordController::class, 'verify'])
    ->middleware('throttle:5,1')
    ->name('site-password.verify');

// Legacy `/settings/*` URLs now live under `/admin/*` (see routes/admin.php).
// Hardcoded targets here — `Route::redirect()` resolves the target URL at
// registration time, so a `route('admin.profile')` lookup fails before
// admin.php has been loaded.
Route::redirect('settings', '/admin/profile');
Route::redirect('settings/profile', '/admin/profile');
Route::redirect('settings/password', '/admin/profile/password');
Route::redirect('settings/appearance', '/admin/profile/appearance');
Route::redirect('settings/two-factor', '/admin/profile/two-factor');

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

// Visual-editor prebuilt SPA assets (CORS-enabled for the Gutenberg
// iframe canvas). Path constraint deliberately excludes `site` and
// `site/...` so the package's catch-all SPA route at
// `/visual-editor/site/{path?}` still wins for those URLs.
Route::get('/visual-editor/{path}', VisualEditorAssetController::class)
    ->where('path', '^(?!site($|/)).+$')
    ->name('visual-editor.asset');

// Theme static assets (stylesheet, images, fonts). Themes live outside
// `public/` so the controller validates the slug + path and serves a
// strict allowlist of extensions. See ThemeAssetController.
Route::get('/themes/{theme}/{path}', ThemeAssetController::class)
    ->where('path', '.+')
    ->name('themes.asset');

// Public form rendering. Dedicated route so themes can deep-link a form
// (e.g. "Open the contact form in its own page") without needing the
// visual editor to embed it inline.
Route::middleware(['feature:forms', 'site.access'])
    ->get('forms/{form}', [PublicFormController::class, 'show'])
    ->name('public.forms.show');

require __DIR__.'/admin.php';
require __DIR__.'/auth.php';

// Public CMS page catch-all. Must come LAST so it doesn't shadow
// admin/auth/blog/visual-editor routes. The path constraint blocks
// any prefix used by those route groups before it reaches the
// PublicPageController. New top-level admin segments must be added to
// this list to stay out of the page-resolution path.
Route::get('/{path}', [PublicPageController::class, 'show'])
    ->where('path', '^(?!admin($|/)|api($|/)|auth($|/)|blog($|/)|forms($|/)|install($|/)|settings($|/)|site-password($|/)|themes($|/)|visual-editor($|/)|build($|/)|storage($|/)|assets($|/)|favicon\\.ico$|robots\\.txt$|sitemap[\\-a-z0-9]*\\.xml$).+$')
    ->middleware('site.access')
    ->name('public.show');
