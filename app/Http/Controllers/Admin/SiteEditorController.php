<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use ArtisanPackUI\VisualEditor\SiteEditor\Gates\SiteEditorAccessGate;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Admin entry-point for the visual-editor site editor SPA.
 *
 * The site editor is a full-viewport Gutenberg SPA — not an Inertia
 * page. This controller serves the package's `site-editor.index` blade
 * directly (Keystone overrides that blade to load the prebuilt dist
 * bundle and to set `data-route-base` / `data-exit-*`), so the editor
 * lives at a stable `/admin/site-editor` URL alongside the rest of the
 * admin surface. The `{path?}` catch-all means every SPA sub-path
 * (`/admin/site-editor/templates/single`, …) renders the same shell —
 * the SPA's own client-side router takes over from there.
 *
 * Access is decided by the bound `SiteEditorAccessGate`
 * ({@see \App\SiteEditor\KeystoneSiteEditorGate}), which composes the
 * cms-framework install probe ahead of an admin-role check. The
 * route's `role:admin` middleware already filters non-admins;
 * invoking the gate here brings the install-probe half of the
 * composition onto this route and keeps its gating identical to the
 * package's own `/visual-editor/site` route, which resolves the same
 * binding.
 *
 * Before #43 this route `Inertia::location()`-redirected to the
 * package's `/visual-editor/site` route; serving the blade directly
 * keeps the URL under `/admin/*` and drops the redirect hop.
 */
class SiteEditorController extends Controller
{
    public function __invoke(Request $request, SiteEditorAccessGate $gate): Response
    {
        if ($denial = $gate->check($request)) {
            return $denial;
        }

        return response()->view('visual-editor::site-editor.index');
    }
}
