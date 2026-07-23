<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gate the public site behind a shared password when
 * `general.siteVisibility` is set to `password-protected`.
 *
 * Unauthenticated visitors who have not yet unlocked the site (no
 * `site_access_granted` session flag) are redirected to the password entry
 * screen. Authenticated users always pass so admins/editors can browse the
 * public site without the prompt. If the mode is active but no password has
 * been configured, the gate stays open rather than locking everyone out.
 *
 *     Route::get('/', ...)->middleware('site.access');
 */
class EnsureSiteIsAccessible
{
    /**
     * Session flag set once a visitor enters the correct site password.
     */
    public const SESSION_KEY = 'site_access_granted';

    public function handle(Request $request, Closure $next): Response
    {
        if ('password-protected' !== (string) apGetSetting('general.siteVisibility')) {
            return $next($request);
        }

        if (null !== $request->user()) {
            return $next($request);
        }

        if (true === $request->session()->get(self::SESSION_KEY)) {
            return $next($request);
        }

        if ('' === (string) apGetSetting('general.sitePassword')) {
            return $next($request);
        }

        if ($request->isMethod('GET')) {
            $request->session()->put('url.intended', $request->fullUrl());
        }

        return redirect()->route('site-password.show');
    }
}
