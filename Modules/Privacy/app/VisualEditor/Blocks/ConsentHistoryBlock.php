<?php

declare(strict_types=1);

namespace Modules\Privacy\VisualEditor\Blocks;

use ArtisanPackUI\VisualEditor\Blocks\DynamicBlock;
use Illuminate\Contracts\Auth\Authenticatable;

/**
 * `keystone/privacy-consent-history` — user-facing block that renders the
 * logged-in visitor's consent history and lets them revoke.
 *
 * Server-side render emits a mount `<div>` with data attributes the
 * `keystone-privacy-island` bundle hydrates into the package's React
 * `ConsentPreferences` component. Guests see the "please sign in"
 * placeholder because consent history is only meaningful for a known
 * subject.
 */
class ConsentHistoryBlock extends DynamicBlock
{
    public function name(): string
    {
        return 'keystone/privacy-consent-history';
    }

    public function render(array $attrs, ?Authenticatable $user = null): string
    {
        if (null === $user) {
            return '<div class="keystone-privacy-block keystone-privacy-block--placeholder">Sign in to review your recorded consents.</div>';
        }

        return '<div class="keystone-privacy-block" data-privacy-block="consent-history" data-user-id="'.(int) $user->getAuthIdentifier().'"></div>';
    }
}
