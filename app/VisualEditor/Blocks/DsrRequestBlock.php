<?php

declare(strict_types=1);

namespace App\VisualEditor\Blocks;

use ArtisanPackUI\VisualEditor\Blocks\DynamicBlock;
use Illuminate\Contracts\Auth\Authenticatable;

/**
 * `keystone/privacy-dsr-request` — public block that lets a visitor
 * submit an access / export / deletion / rectification request.
 *
 * Server-side render emits a mount div; the client island hydrates it
 * into the package's `<DataRequestForm />`. Anonymous visitors can
 * submit — the package's verification flow (email token, etc.) enforces
 * subject identity.
 */
class DsrRequestBlock extends DynamicBlock
{
    public function name(): string
    {
        return 'keystone/privacy-dsr-request';
    }

    public function render(array $attrs, ?Authenticatable $user = null): string
    {
        return '<div class="keystone-privacy-block" data-privacy-block="dsr-request"'
            .(null !== $user ? ' data-user-id="'.(int) $user->getAuthIdentifier().'"' : '')
            .'></div>';
    }
}
