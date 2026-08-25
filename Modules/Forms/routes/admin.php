<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Forms\Http\Controllers\FormController;

/*
|--------------------------------------------------------------------------
| Forms Admin Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\Forms\Providers\RouteServiceProvider`, which wraps this
| file in the shared admin group (`web` + auth/2FA stack, `admin` prefix,
| `admin.` name prefix). Names and URIs are unchanged from the central
| `routes/admin.php` these were extracted from — see
| plans/14-modular-laravel-setup.md §3.3.
|
| The `feature:forms` gate below is the one that wrapped these routes in the
| central file, reapplied here so the middleware stack `route:list` reports is
| identical. Unlike most admin groups these routes carry no `role:` gate — that
| is how the central file had them, and widening or narrowing access is not
| this extraction's business.
|
*/

Route::middleware('feature:forms')
    ->prefix('forms')
    ->name('forms.')
    ->group(function (): void {
        Route::get('/', [FormController::class, 'index'])->name('index');
        Route::post('/', [FormController::class, 'create'])->name('create');
        Route::get('submissions', [FormController::class, 'submissions'])->name('submissions.all');
        // `{form:id}` overrides the model's slug-based route key so
        // admin URLs stay stable when a user renames a form (which
        // regenerates the slug via the package's `creating` hook).
        Route::get('{form:id}/edit', [FormController::class, 'edit'])->name('edit');
        Route::delete('{form:id}', [FormController::class, 'destroy'])->name('destroy');
        Route::get('{form:id}/submissions', [FormController::class, 'submissions'])->name('submissions.index');
        Route::get('{form:id}/submissions/{submission}', [FormController::class, 'submissionShow'])->name('submissions.show');
    });
