<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Middleware\EnsureSiteIsAccessible;
use App\Support\SiteBranding;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Renders and processes the shared-password gate that fronts the public
 * site when `general.siteVisibility` is `password-protected`.
 *
 * The screen is reachable regardless of the gate (its routes are not behind
 * {@see EnsureSiteIsAccessible}); both endpoints short-circuit to the
 * homepage when password protection is not active so the form never appears
 * for a public site.
 */
class SitePasswordController extends Controller
{
    /**
     * Show the password entry screen.
     */
    public function show(Request $request): View|RedirectResponse
    {
        if (! $this->gateIsActive($request)) {
            return redirect()->route('home');
        }

        return view('site-password', [
            'siteIcon' => SiteBranding::icon(),
        ]);
    }

    /**
     * Verify the submitted password and, on success, unlock the site for the
     * current session and return to the originally requested page.
     */
    public function verify(Request $request): RedirectResponse
    {
        if (! $this->gateIsActive($request)) {
            return redirect()->route('home');
        }

        $request->validate([
            'password' => ['required', 'string'],
        ]);

        $stored = (string) apGetSetting('general.sitePassword');

        if ('' === $stored || ! Hash::check($request->string('password')->toString(), $stored)) {
            throw ValidationException::withMessages([
                'password' => __('That password is incorrect.'),
            ]);
        }

        $request->session()->put(EnsureSiteIsAccessible::SESSION_KEY, true);
        $request->session()->regenerate();

        return redirect()->intended(route('home'));
    }

    /**
     * Password protection is only active for guests when the visibility mode
     * is set and a password has been configured. Authenticated users bypass
     * the gate entirely, so the screen is irrelevant to them.
     */
    private function gateIsActive(Request $request): bool
    {
        if (null !== $request->user()) {
            return false;
        }

        return 'password-protected' === (string) apGetSetting('general.siteVisibility')
            && '' !== (string) apGetSetting('general.sitePassword');
    }
}
