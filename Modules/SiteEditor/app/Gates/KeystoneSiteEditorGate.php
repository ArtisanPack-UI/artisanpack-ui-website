<?php

declare(strict_types=1);

namespace Modules\SiteEditor\Gates;

use ArtisanPackUI\VisualEditor\SiteEditor\Gates\CmsFrameworkInstallGate;
use ArtisanPackUI\VisualEditor\SiteEditor\Gates\SiteEditorAccessGate;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keystone's access gate for the visual-editor site editor SPA.
 *
 * Composes the bundled `CmsFrameworkInstallGate` ahead of an admin-role
 * check. Running the install probe first is deliberate: on a half-
 * installed deployment (cms-framework missing) the user sees the
 * actionable install instructions rather than a generic 403 that leaks
 * deployment state.
 *
 * Bound via `SiteEditorServiceProvider::register()` against the package's
 * `SiteEditorAccessGate` contract — the visual-editor catch-all route
 * resolves whatever is bound, so this gate fires for every request to
 * `/visual-editor/site/{path?}`.
 *
 * Per `plans/08-themes-site-editor-arc.md`, the site editor is
 * admin-role only in Keystone. Editor and site_owner roles do not get
 * access — they edit individual pages / posts, not global templates,
 * patterns, or styles.
 */
class KeystoneSiteEditorGate implements SiteEditorAccessGate
{
    public function __construct(
        protected CmsFrameworkInstallGate $installGate,
    ) {}

    public function check(Request $request): ?Response
    {
        if ($denial = $this->installGate->check($request)) {
            return $denial;
        }

        $user = $request->user();

        if (! $user) {
            return redirect()->guest(route('login'));
        }

        if (! method_exists($user, 'hasRole') || ! $user->hasRole('admin')) {
            abort(403);
        }

        return null;
    }
}
