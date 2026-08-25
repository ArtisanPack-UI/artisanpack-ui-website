<?php

declare(strict_types=1);

namespace Modules\SiteEditor\Widgets;

use Modules\Installer\Support\KeystoneSampleData;
use Modules\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface;
use Modules\Users\Models\User;

/**
 * Stacked-bar lead funnel showing visitor → customer conversion.
 *
 * Demo-data backed until the Forms feature lands.
 */
class LeadFunnelWidget implements KeystoneAdminWidgetInterface
{
    /**
     * @return array{title: string, description: string}
     */
    public static function getWidgetInfo(): array
    {
        return [
            'title'       => 'Lead funnel',
            'description' => 'Conversion through each stage of the lead funnel.',
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     *
     * @return array{funnel: list<array{label: string, value: int}>}
     */
    public static function getData(User $user, array $options): array
    {
        return [
            'funnel' => KeystoneSampleData::leadFunnel(),
        ];
    }

    /**
     * @return array{component: string, is_demo: bool}
     */
    public static function extendedInfo(): array
    {
        return [
            'component' => 'LeadFunnelWidget',
            'is_demo'   => true,
        ];
    }
}
