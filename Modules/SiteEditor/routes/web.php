<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\SiteEditor\Http\Controllers\VisualEditorAssetController;

/*
|--------------------------------------------------------------------------
| SiteEditor Public Routes
|--------------------------------------------------------------------------
|
| One route: the prebuilt visual-editor SPA assets. Lifted verbatim out of
| the central `routes/web.php`; the `web` middleware group it used to inherit
| from `withRouting(web: ...)` is reapplied by this module's
| `RouteServiceProvider`.
|
*/

// Visual-editor prebuilt SPA assets (CORS-enabled for the Gutenberg
// iframe canvas). Path constraint deliberately excludes `site` and
// `site/...` so the package's catch-all SPA route at
// `/visual-editor/site/{path?}` still wins for those URLs.
Route::get('/visual-editor/{path}', VisualEditorAssetController::class)
    ->where('path', '^(?!site($|/)).+$')
    ->name('visual-editor.asset');
