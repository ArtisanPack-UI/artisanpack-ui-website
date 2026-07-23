<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gate the `/install` route until the installer has run, then lock it shut.
 *
 * Per `plans/06-keystone-plan.md` §5.3, the install wizard is reachable only
 * when:
 *   - the `.installed` flag is missing, AND
 *   - the requesting IP matches the optional allowlist, AND
 *   - the one-time install token (`KEYSTONE_INSTALL_TOKEN`) is provided.
 *
 * Once installed, every request to `/install` is fully bypassed (404) so the
 * surface stops existing rather than just refusing input.
 *
 *     Route::get('/install', ...)->middleware('installed:guard');
 *     Route::get('/dashboard', ...)->middleware('installed:require');
 *
 * Modes:
 *   - `guard`   → for the installer itself (default). Allows pre-install
 *                 access with token+IP; aborts 404 once installed.
 *   - `require` → for the rest of the app. Redirects to `/install` if not
 *                 yet installed; otherwise passes through.
 *
 * Within `guard` mode, the token check only fires on safe HTTP methods
 * (GET/HEAD). Once the initial GET passes, {@see InstallController::show()}
 * sets a single-use session grant (`install.granted`); subsequent POSTs
 * are authorized off that grant instead of carrying the token in the URL,
 * so the credential never appears in the browser address bar or server
 * access logs.
 */
class Installed
{
    /**
     * Session key set by the installer's GET handler to authorize the
     * follow-up POST without putting the token back on the URL.
     */
    public const SESSION_GRANT_KEY = 'install.granted';

    public function handle(Request $request, Closure $next, string $mode = 'guard'): Response
    {
        $isInstalled = $this->isInstalled();

        if ('require' === $mode) {
            if (! $isInstalled) {
                return redirect('/install');
            }

            return $next($request);
        }

        if ($isInstalled) {
            abort(404);
        }

        if (! $this->ipAllowed($request->ip())) {
            abort(403, 'Install access denied for this IP.');
        }

        if ($request->isMethodSafe()) {
            if (! $this->tokenMatches($request->query('token'))) {
                abort(403, 'Invalid install token.');
            }
        } elseif (! $this->hasSessionGrant($request)) {
            // POST/PUT/PATCH after a fresh page load needs the grant the
            // GET handler stamped on this session. Missing/expired grant
            // means the operator's window timed out — make them reload.
            abort(403, 'Install session expired — reload /install?token=… to retry.');
        }

        return $next($request);
    }

    protected function hasSessionGrant(Request $request): bool
    {
        if (! $request->hasSession()) {
            return false;
        }

        return true === $request->session()->get(self::SESSION_GRANT_KEY);
    }

    protected function isInstalled(): bool
    {
        return is_file($this->flagPath());
    }

    protected function flagPath(): string
    {
        return (string) config('keystone.install.flag_path', storage_path('app/.installed'));
    }

    protected function ipAllowed(?string $ip): bool
    {
        $allowlist = (array) config('keystone.install.ip_allowlist', []);

        if ([] === $allowlist) {
            return true;
        }

        return null !== $ip && in_array($ip, $allowlist, true);
    }

    protected function tokenMatches(mixed $provided): bool
    {
        $expected = (string) config('keystone.install.token', '');

        if ('' === $expected || ! is_string($provided)) {
            return false;
        }

        return hash_equals($expected, $provided);
    }
}
