<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Forms\Http\Controllers\PublicFormController;

/*
|--------------------------------------------------------------------------
| Forms Public Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Forms\Providers\RouteServiceProvider`, which wraps this
| file in the `web` middleware group the central `routes/web.php` supplied
| implicitly via `withRouting(web: ...)`. The name and URI are unchanged from
| that file — see plans/14-modular-laravel-setup.md §3.3.
|
| Public form rendering. Dedicated route so themes can deep-link a form
| (e.g. "Open the contact form in its own page") without needing the
| visual editor to embed it inline.
|
| `{form}` resolves through the explicit binding in `FormsServiceProvider`,
| which keeps this route slug-only — a form whose slug happens to be numeric
| must not resolve as an id here.
|
| The route is only reachable because the central catch-all's path constraint
| already excludes `forms($|/)`: module routes register after `routes/web.php`,
| so ordering does not protect it (§3.3). `FormsRoutesTest` pins that through
| the router's own matcher.
|
*/

Route::middleware(['feature:forms', 'site.access'])
    ->get('forms/{form}', [PublicFormController::class, 'show'])
    ->name('public.forms.show');
