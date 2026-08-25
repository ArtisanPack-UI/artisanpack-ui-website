<?php

declare(strict_types=1);

use App\Http\Controllers\PreviewController;
use App\Http\Controllers\SitePasswordController;
use Illuminate\Support\Facades\Route;
use Modules\Pages\Http\Controllers\PublicPageController;

// The `install.show`/`install.store` routes live in the Installer module
// (`Modules/Installer/routes/web.php`), which reapplies `installed:guard`
// inside its own route file. Their `install($|/)` alternative in the
// catch-all constraint below stays here — that constraint is what keeps the
// module routes reachable at all (see the note on the catch-all).

// `PublicPageController` lives in the Pages module
// (`Modules/Pages/app/Http/Controllers/`), but `home` and the `/{path}` catch-all
// below both stay here. The catch-all's negative-lookahead constraint is what
// keeps every *other* module's public routes reachable — module routes register
// after this file (plans/14-modular-laravel-setup.md §3.3) — so moving it into
// Pages would put a shared constraint inside one module and register it after
// the routes it has to yield to. `home` stays with it: same controller, same
// resolution path, and splitting the pair across two files buys nothing.
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

// The `blog.index`, `blog.show` and `comments.store` routes live in the Blog
// module (`Modules/Blog/routes/web.php`), which reapplies `feature:blog` and
// `site.access` inside its own route file. Their `blog($|/)` alternative in the
// catch-all constraint below stays here — that constraint is what keeps the two
// GET routes reachable at all (see the note on the catch-all). `comments` is
// POST-only and so is deliberately absent from it.

// The `visual-editor.asset` route lives in the SiteEditor module
// (`Modules/SiteEditor/routes/web.php`). Its `visual-editor($|/)`
// alternative in the catch-all constraint below stays here — that
// constraint is what keeps the module route reachable at all (see the note
// on the catch-all).

// The `themes.asset` route lives in the Themes module
// (`Modules/Themes/routes/web.php`). It stays reachable despite registering
// after the catch-all below because `themes($|/)` is already one of that
// route's excluded prefixes — see the module's RouteServiceProvider.

// The `public.forms.show` route lives in the Forms module
// (`Modules/Forms/routes/web.php`), which reapplies `feature:forms` and
// `site.access` inside its own route file. Its `forms($|/)` alternative in
// the catch-all constraint below stays here — that constraint is what keeps
// the module route reachable at all (see the note on the catch-all).

// Signed-URL preview endpoint. `signed` middleware verifies the HMAC
// + expiration timestamp before the controller runs, so an invalid or
// expired signature returns 403 and never reaches PreviewController.
// Deliberately NOT behind `site.access` — sharing a preview link with
// a reviewer who isn't behind the site password is the entire point.
// `type` is constrained to the surfaces PreviewUrl knows how to sign
// today (post|page); adding CPT support means widening the pattern.
Route::get('/preview/{type}/{id}', PreviewController::class)
    ->where('type', 'post|page')
    ->where('id', '[0-9]+')
    ->middleware('signed')
    ->name('preview.show');

require __DIR__.'/admin.php';

// Public CMS page catch-all. Must come LAST so it doesn't shadow
// admin/auth/blog/visual-editor routes. The path constraint blocks
// any prefix used by those route groups before it reaches the
// PublicPageController. New top-level admin segments must be added to
// this list to stay out of the page-resolution path.
//
// "Last" is only true within this file. Module route files are mapped by
// each module's own RouteServiceProvider and land AFTER everything here
// (measured: this route at index 620, `register` at 622, `login` at 624),
// so for a module route the constraint is not a belt-and-braces guard —
// it is the only thing keeping this route off the URI, and `{path}`'s
// `.+` pattern matches slashes too
// (plans/14-modular-laravel-setup.md §3.3). Every module extracted
// before Auth (#207) owned `admin/`-prefixed routes only and so was covered
// by the `admin($|/)` alternative already present. The Auth module's routes
// are top-level, which is why its eight GET URIs are listed individually
// below; they were previously protected by ordering alone, since
// `routes/auth.php` was `require`d immediately above this route.
//
// Each auth entry reserves exactly what the module serves, no more. Six of
// them are exact URIs and so are `$`-anchored (as `favicon\.ico$` and
// `robots\.txt$` already are here); only `reset-password/{token}` and
// `verify-email/{id}/{hash}` own a sub-tree and take `($|/)`. Widening the
// six to `($|/)` would newly 404 a CMS page at `/register/team` — behaviour
// this extraction has no business changing. The corollary: ADDING a GET
// sub-route under one of the six (`login/sso`, say) means widening its
// alternative here in the same change, or the catch-all eats it.
//
// The POST-only auth URIs (`logout`, `email/verification-notification`) are
// not listed at all, for the same reason: this route only answers GET, so
// they cannot be shadowed, and reserving `logout` or `email` would newly
// forbid a CMS page at either slug.
//
// `AuthRoutesTest` pins all three groups — reserved, not-reserved, and the
// sub-tree boundary.
Route::get('/{path}', [PublicPageController::class, 'show'])
    ->where('path', '^(?!admin($|/)|api($|/)|auth($|/)|blog($|/)|confirm-password$|forgot-password$|forms($|/)|install($|/)|login$|logout-link$|preview($|/)|register$|reset-password($|/)|settings($|/)|site-password($|/)|themes($|/)|two-factor-challenge$|verify-email($|/)|visual-editor($|/)|build($|/)|storage($|/)|assets($|/)|favicon\\.ico$|robots\\.txt$|sitemap[\\-a-z0-9]*\\.xml$).+$')
    ->middleware('site.access')
    ->name('public.show');
