<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use ArtisanPackUI\CMSFramework\Modules\Settings\Managers\SettingsManager;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Forces enrollment in two-factor authentication before the admin shell is
 * reachable when `security.forceTwoFactor` is enabled.
 *
 * Users who already have 2FA enabled, and every user while the setting is off,
 * pass through untouched. The two-factor management routes are exempt so the
 * redirect target stays reachable and no loop forms.
 */
class EnsureTwoFactorEnrollment
{
    public function __construct(private readonly SettingsManager $settings) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (
            null !== $user &&
            method_exists($user, 'hasTwoFactorEnabled') &&
            ! $user->hasTwoFactorEnabled() &&
            $this->forceTwoFactorEnabled() &&
            ! $request->routeIs('admin.two-factor', 'admin.two-factor.*')
        ) {
            return redirect()
                ->route('admin.two-factor')
                ->with('error', 'Two-factor authentication is required. Enable it to continue to the admin.');
        }

        return $next($request);
    }

    /**
     * Whether the `security.forceTwoFactor` setting is currently enabled.
     */
    private function forceTwoFactorEnabled(): bool
    {
        return filter_var(
            $this->settings->getSetting('security.forceTwoFactor'),
            FILTER_VALIDATE_BOOL,
        );
    }
}
