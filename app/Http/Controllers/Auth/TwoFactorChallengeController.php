<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use ArtisanPackUI\SecurityAuth\Facades\TwoFactor;
use ArtisanPackUI\SecurityAuth\Http\Middleware\TwoFactorMiddleware;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Handles the post-password OTP challenge for users with 2FA enabled.
 *
 * The challenge itself is delivered through the artisanpack-ui/security-auth
 * {@see TwoFactor} manager (email OTP by default). A successful verification
 * stamps {@see TwoFactorMiddleware::SESSION_KEY} so the package middleware
 * lets the user reach the admin shell for the remainder of the session.
 */
class TwoFactorChallengeController extends Controller
{
    /**
     * Show the challenge form, dispatching a fresh OTP when none is pending.
     */
    public function create(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        // Nothing to challenge: users without 2FA, or those already verified
        // this session, continue to wherever they were headed.
        if (null === $user || ! $user->hasTwoFactorEnabled()) {
            return redirect()->intended(route('admin.dashboard', absolute: false));
        }

        if ($request->session()->get(TwoFactorMiddleware::SESSION_KEY)) {
            return redirect()->intended(route('admin.dashboard', absolute: false));
        }

        // Only dispatch a new code when one is not already pending, so that a
        // page refresh does not burn the package's generation rate limit.
        if (! $this->hasPendingChallenge($request, $user->getAuthIdentifier())) {
            TwoFactor::generateChallenge($user);
        }

        return Inertia::render('auth/TwoFactorChallenge', [
            'status' => session('status'),
        ]);
    }

    /**
     * Verify the submitted OTP and mark the session as 2FA-verified.
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'code' => ['required', 'string'],
        ]);

        $user = $request->user();

        if (null === $user || ! $user->hasTwoFactorEnabled()) {
            return redirect()->intended(route('admin.dashboard', absolute: false));
        }

        if (! TwoFactor::verify($user, $request->string('code')->value())) {
            doAction('keystone.auth.twoFactorFailed', $user);

            throw ValidationException::withMessages([
                'code' => 'The provided two-factor code is invalid or has expired.',
            ]);
        }

        doAction('keystone.auth.twoFactorVerified', $user);

        $request->session()->put(TwoFactorMiddleware::SESSION_KEY, true);

        return redirect()->intended(route('admin.dashboard', absolute: false));
    }

    /**
     * Whether an unexpired challenge for this user is already held in session.
     */
    private function hasPendingChallenge(Request $request, int|string $userId): bool
    {
        $expires = $request->session()->get('two_factor_expires');

        return $request->session()->get('two_factor_user_id') === $userId
            && null !== $expires
            && now()->lessThan($expires);
    }
}
