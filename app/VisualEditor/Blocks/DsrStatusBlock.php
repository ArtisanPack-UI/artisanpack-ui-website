<?php

declare(strict_types=1);

namespace App\VisualEditor\Blocks;

use ArtisanPackUI\VisualEditor\Blocks\DynamicBlock;
use Illuminate\Contracts\Auth\Authenticatable;

/**
 * `keystone/privacy-dsr-status` — logged-in block that surfaces the
 * status of the current subject's prior data-subject requests. Rendered
 * by the package's `<PrivacyDashboard />` React component on the
 * client side.
 */
class DsrStatusBlock extends DynamicBlock
{
    public function name(): string
    {
        return 'keystone/privacy-dsr-status';
    }

    public function render(array $attrs, ?Authenticatable $user = null): string
    {
        if (null === $user) {
            return '<div class="keystone-privacy-block keystone-privacy-block--placeholder">Sign in to view your recent privacy requests.</div>';
        }

        return '<div class="keystone-privacy-block" data-privacy-block="dsr-status" data-user-id="'.(int) $user->getAuthIdentifier().'"></div>';
    }
}
