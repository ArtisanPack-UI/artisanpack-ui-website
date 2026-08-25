<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\ContentModel\Http\Controllers\ContentTypeContentController;
use Modules\ContentModel\Http\Controllers\ContentTypeController;
use Modules\ContentModel\Http\Controllers\CustomFieldController;
use Modules\ContentModel\Http\Controllers\TaxonomyController;

/*
|--------------------------------------------------------------------------
| ContentModel Admin Routes
|--------------------------------------------------------------------------
|
| Loaded by `Modules\ContentModel\Providers\RouteServiceProvider`, which wraps
| this file in the shared admin group (`web` + auth/2FA stack, `admin` prefix,
| `admin.` name prefix). Names and URIs are unchanged from the central
| `routes/admin.php` these were extracted from — see
| plans/14-modular-laravel-setup.md §3.3.
|
| The module owns two groups with *different* role gates, and the central file
| declared them under different parents: the generic `content.` CRUD sat under
| `role:admin,site_owner,editor`, the `content-model.` management screens under
| `role:admin`. Both are reapplied here verbatim rather than merged, so the
| middleware stack `route:list` reports is identical either side of the move.
|
*/

// #106 — Generic content admin routes for any registered content type. `post`
// and `page` are handled by their bespoke controllers — in the Blog and Pages
// modules respectively — and rejected inside
// ContentTypeContentController::resolve() so a match here doesn't accidentally
// shadow them. That rejection is the whole guard, and always was: these routes
// sit under the literal `content/` prefix, so they could never have matched
// `admin/posts/...` on the URI regardless of which file declares it or when it
// registers — which is exactly why moving them into a module, where they now
// register *after* everything in the central admin file, changes nothing. The
// `{contentType}` slug constraint matches the framework's content-type slug
// regex — lowercase letters/digits with single-hyphen separators — so the
// router doesn't have to invoke the controller for obviously malformed URLs.
Route::middleware('role:admin,site_owner,editor')->group(function (): void {
    Route::prefix('content/{contentType}')
        ->name('content.')
        ->where(['contentType' => '[a-z0-9]+(?:-[a-z0-9]+)*'])
        ->group(function (): void {
            Route::get('/', [ContentTypeContentController::class, 'index'])->name('index');
            Route::post('quick-create', [ContentTypeContentController::class, 'quickCreate'])->name('quick-create');
            Route::post('/', [ContentTypeContentController::class, 'store'])->name('store');
            Route::get('{record}/edit', [ContentTypeContentController::class, 'edit'])
                ->where('record', '[0-9]+')
                ->name('edit');
            Route::put('{record}', [ContentTypeContentController::class, 'update'])
                ->where('record', '[0-9]+')
                ->name('update');
            Route::delete('{record}', [ContentTypeContentController::class, 'destroy'])
                ->where('record', '[0-9]+')
                ->name('destroy');
        });
});

// #105 — Content Model admin. Wraps the framework's ContentTypes managers
// (ContentType/Taxonomy/CustomField) directly, same pattern as themes/plugins.
// Admin-only: creating a content type mutates the DB schema
// (CustomFieldManager::addColumnToTable) and registers filter hooks, which is
// the same install-shaped surface that gates themes and plugins.
Route::middleware('role:admin')->group(function (): void {
    Route::prefix('content-model')->name('content-model.')->group(function (): void {
        Route::get('content-types', [ContentTypeController::class, 'index'])->name('content-types.index');
        Route::post('content-types', [ContentTypeController::class, 'store'])->name('content-types.store');
        Route::get('content-types/{contentType}/edit', [ContentTypeController::class, 'edit'])->name('content-types.edit');
        Route::put('content-types/{contentType}', [ContentTypeController::class, 'update'])->name('content-types.update');
        Route::delete('content-types/{contentType}', [ContentTypeController::class, 'destroy'])->name('content-types.destroy');

        Route::get('taxonomies', [TaxonomyController::class, 'index'])->name('taxonomies.index');
        Route::post('taxonomies', [TaxonomyController::class, 'store'])->name('taxonomies.store');
        Route::get('taxonomies/{taxonomy}/edit', [TaxonomyController::class, 'edit'])->name('taxonomies.edit');
        Route::put('taxonomies/{taxonomy}', [TaxonomyController::class, 'update'])->name('taxonomies.update');
        Route::delete('taxonomies/{taxonomy}', [TaxonomyController::class, 'destroy'])->name('taxonomies.destroy');
        // Term creation inlined so the record-edit sidebar can add terms
        // without a round trip through a separate Terms admin surface.
        // Widened past the surrounding `role:admin` group because the caller —
        // DynamicContentEdit — renders for admin/site_owner/editor; keeping
        // this admin-only caused the sidebar's Add button to 403 silently.
        Route::post('taxonomies/{taxonomy}/terms', [TaxonomyController::class, 'storeTerm'])
            ->withoutMiddleware('role:admin')
            ->middleware('role:admin,site_owner,editor')
            ->name('taxonomies.terms.store');

        Route::get('custom-fields', [CustomFieldController::class, 'index'])->name('custom-fields.index');
        Route::post('custom-fields', [CustomFieldController::class, 'store'])->name('custom-fields.store');
        Route::get('custom-fields/{customField}/edit', [CustomFieldController::class, 'edit'])->name('custom-fields.edit');
        Route::put('custom-fields/{customField}', [CustomFieldController::class, 'update'])->name('custom-fields.update');
        Route::delete('custom-fields/{customField}', [CustomFieldController::class, 'destroy'])->name('custom-fields.destroy');
    });
});
