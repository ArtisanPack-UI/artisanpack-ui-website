<?php

declare(strict_types=1);

namespace Modules\Users\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use ArtisanPackUI\SecurityAuth\Http\Middleware\TwoFactorMiddleware;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Two-factor authentication settings page.
 *
 * Enables/disables 2FA at the database level using the
 * {@see \ArtisanPackUI\SecurityAuth\TwoFactor\TwoFactorAuthenticatable} trait.
 * The login OTP challenge is enforced by {@see TwoFactorMiddleware} on the
 * admin shell and by {@see \Modules\Auth\Http\Controllers\TwoFactorChallengeController}.
 */
class TwoFactorController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('settings/TwoFactor', [
            'enabled'    => $user?->hasTwoFactorEnabled() ?? false,
            'enabled_at' => $user?->two_factor_enabled_at,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (null === $user || $user->hasTwoFactorEnabled()) {
            return back();
        }

        $user->generateTwoFactorSecret();
        $user->generateRecoveryCodes();
        $user->two_factor_enabled_at = now();
        $user->save();

        // The user enrolled from an already-authenticated session, so treat
        // this session as 2FA-verified rather than bouncing them straight to
        // a challenge on the next admin request.
        $request->session()->put(TwoFactorMiddleware::SESSION_KEY, true);

        return back()->with('success', 'Two-factor authentication enabled.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (null === $user) {
            return back();
        }

        $user->two_factor_secret         = null;
        $user->two_factor_recovery_codes = null;
        $user->two_factor_enabled_at     = null;
        $user->save();

        return back()->with('success', 'Two-factor authentication disabled.');
    }
}
