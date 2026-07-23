<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gate routes behind a Keystone feature flag.
 *
 * Aborts 404 (not 403) when the flag is off so disabled features are
 * indistinguishable from non-existent routes. Users with the configured
 * admin role bypass the check so the maintainer can debug disabled
 * features in production.
 *
 *     Route::get('/admin/blog', ...)->middleware('feature:blog');
 */
class EnsureFeatureIsEnabled
{
    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $user = $request->user();

        if (null !== $user) {
            $adminRole = (string) keystone('admin_role', 'admin');

            if (method_exists($user, 'hasRole') && $user->hasRole($adminRole)) {
                return $next($request);
            }
        }

        if (! (bool) keystone('features.'.$feature, false)) {
            abort(404);
        }

        return $next($request);
    }
}
