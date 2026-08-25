<?php

declare(strict_types=1);

namespace Modules\SiteEditor\Widgets;

use Modules\Installer\Support\KeystoneSampleData;
use Modules\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface;
use Modules\Users\Models\User;

/**
 * Recent leads list, limited to the latest few submissions.
 *
 * Demo-data backed until the Forms feature lands. The slicing happens here
 * (not in `KeystoneSampleData`) so the sample helper keeps a stable canonical
 * row set callers can reuse across widgets and pages.
 */
class RecentLeadsWidget implements KeystoneAdminWidgetInterface
{
    private const DEFAULT_LIMIT = 5;

    /**
     * @return array{title: string, description: string, default_options: array{limit: int}}
     */
    public static function getWidgetInfo(): array
    {
        return [
            'title'           => 'Recent leads',
            'description'     => 'Latest submissions from every form.',
            'default_options' => [
                'limit' => self::DEFAULT_LIMIT,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     *
     * @return array{leads: list<array{id: int, name: string, email: string, form: string, company: string, received_at: string, status: string}>}
     */
    public static function getData(User $user, array $options): array
    {
        $limit = self::resolveLimit($options);

        return [
            'leads' => array_slice(KeystoneSampleData::recentLeads(), 0, $limit),
        ];
    }

    /**
     * @return array{component: string, is_demo: bool}
     */
    public static function extendedInfo(): array
    {
        return [
            'component' => 'RecentLeadsWidget',
            'is_demo'   => true,
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     */
    private static function resolveLimit(array $options): int
    {
        $candidate = $options['limit'] ?? null;

        if (is_int($candidate) && $candidate > 0) {
            return $candidate;
        }

        return self::DEFAULT_LIMIT;
    }
}
