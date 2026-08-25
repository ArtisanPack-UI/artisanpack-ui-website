<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\SiteEditor\Http\Controllers\DashboardController;
use Modules\SiteEditor\Http\Controllers\SiteEditorController;

/*
|--------------------------------------------------------------------------
| SiteEditor Admin Routes
|--------------------------------------------------------------------------
|
| Lifted verbatim out of the central `routes/admin.php`. The enclosing
| middleware / prefix / name settings are reapplied by this module's
| `RouteServiceProvider`, so every name below still resolves exactly as it
| did before the extraction (`admin.dashboard`, `admin.dashboards.*`,
| `admin.site-editor`).
|
*/

Route::get('/', [DashboardController::class, 'index'])->name('dashboard');

// Dashboard CRUD + management. Literal-path routes (`manage`,
// `reorder`) are declared before the `{slug}` wildcards so the
// wildcard doesn't capture them as a dashboard slug.
Route::get('dashboards', [DashboardController::class, 'dashboardsIndex'])->name('dashboards.index');
Route::get('dashboards/manage', [DashboardController::class, 'manage'])->name('dashboards.manage');
Route::post('dashboards', [DashboardController::class, 'store'])->name('dashboards.store');
Route::patch('dashboards/reorder', [DashboardController::class, 'reorder'])->name('dashboards.reorder');
Route::patch('dashboards/{slug}', [DashboardController::class, 'update'])->name('dashboards.update');
Route::delete('dashboards/{slug}', [DashboardController::class, 'destroy'])->name('dashboards.destroy');

Route::get('dashboards/{slug}', [DashboardController::class, 'show'])->name('dashboards.show');
Route::post('dashboards/{slug}/apply-starter', [DashboardController::class, 'applyStarter'])->name('dashboards.apply-starter');
Route::post('dashboards/{slug}/widgets', [DashboardController::class, 'storeWidget'])->name('dashboards.widgets.store');
Route::patch('dashboards/{slug}/widgets/reorder', [DashboardController::class, 'reorderWidgets'])->name('dashboards.widgets.reorder');
Route::patch('dashboards/{slug}/widgets/{id}/layout', [DashboardController::class, 'updateWidgetLayout'])->name('dashboards.widgets.layout');
Route::patch('dashboards/{slug}/widgets/{id}', [DashboardController::class, 'updateWidget'])->name('dashboards.widgets.update');
Route::delete('dashboards/{slug}/widgets/{id}', [DashboardController::class, 'destroyWidget'])->name('dashboards.widgets.destroy');

// `role:admin` is reapplied here rather than in the RouteServiceProvider:
// everything above runs on the shared admin stack, and only the site editor
// sat inside the central file's `role:admin` sub-group.
Route::middleware('role:admin')->group(function (): void {
    // #43 — admin entry-point for the visual-editor site
    // editor. Serves the SPA blade directly so the editor
    // lives at `/admin/site-editor` (the catch-all `{path?}`
    // hands every SPA sub-path the same shell). The
    // `role:admin` middleware filters non-admins; the
    // controller additionally invokes the bound
    // `KeystoneSiteEditorGate` for the cms-framework install
    // probe.
    Route::get('site-editor/{path?}', SiteEditorController::class)
        ->where('path', '.*')
        ->name('site-editor');
});
