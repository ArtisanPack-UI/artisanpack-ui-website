<?php

declare(strict_types=1);

namespace Modules\Auth\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;
use Modules\Auth\Http\Requests\LoginRequest;

class AuthenticatedSessionController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status'           => session('status'),
        ]);
    }

    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        // Users with 2FA enabled must clear the OTP challenge before reaching
        // the admin. The fresh session drops any prior `two_factor_verified`
        // flag, so the challenge controller dispatches a new code.
        $user = $request->user();

        if (null !== $user) {
            doAction('keystone.auth.loggedIn', $user);
        }

        if (null !== $user && $user->hasTwoFactorEnabled()) {
            doAction('keystone.auth.twoFactorChallenged', $user);

            return redirect()->route('two-factor.challenge');
        }

        return redirect()->intended(route('admin.dashboard', absolute: false));
    }

    public function destroy(Request $request): RedirectResponse
    {
        // The route is `auth`-gated so `$request->user()` should never
        // be null here, but the guard means a broken middleware chain
        // can't hand subscribers an anonymous `.loggedOut` event.
        $user = $request->user();
        if (null !== $user) {
            doAction('keystone.auth.loggedOut', $user);
        }

        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    /**
     * GET-side logout entry point for the visual-editor `artisanpack/loginout`
     * block (#522). The `signed` middleware on the route verifies the URL
     * signature, so a logged-in visitor following the link cannot be coerced
     * into logging out by a stale or attacker-supplied URL.
     *
     * Honors a `redirect_to` query parameter when the value is a same-host
     * URL; otherwise falls back to the site root, matching {@see destroy}.
     */
    public function destroyViaLink(Request $request): RedirectResponse
    {
        $user = $request->user();
        if (null !== $user) {
            doAction('keystone.auth.loggedOut', $user);
        }

        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        $redirectTo = $request->query('redirect_to');

        if (is_string($redirectTo) && '' !== $redirectTo) {
            $parsed = parse_url($redirectTo);

            if (is_array($parsed)
                && (! isset($parsed['host']) || $parsed['host'] === $request->getHost())) {
                return redirect($redirectTo);
            }
        }

        return redirect('/');
    }
}
