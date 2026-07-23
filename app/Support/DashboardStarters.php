<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Blueprints for the empty-state dashboard starters offered to users who land
 * on a dashboard with no widgets.
 *
 * Each starter is a slug-keyed array with a display name, description, and a
 * list of widget specs. A spec carries a widget `type` (required, must match a
 * registered widget) and optional per-instance `grid_config` and `options`
 * overrides. The full widget instance is materialized at apply time by
 * `AdminWidgetManager::createWidget()` so each cloned widget gets a fresh
 * UUID and inherits whatever defaults the widget class declared via
 * `getWidgetInfo()`.
 *
 * Keep this list small and intentional — these are the on-ramp templates,
 * not the full widget catalog. Adding new starters should be a deliberate UX
 * decision rather than a dumping ground for niche presets.
 */
class DashboardStarters
{
    /**
     * Test override for `all()`. When set, takes precedence over the
     * built-in starters so feature tests can register starter blueprints
     * that reference test-fixture widget types without polluting the real
     * catalog. Cleared via `reset()` in `tearDown()`.
     *
     * @var array<string, array{name: string, description: string, widgets: list<array{type: string, grid_config?: array<string, array{rows: int, cols: int}>, options?: array<string, mixed>}>}>|null
     */
    private static ?array $override = null;

    /**
     * @return array<string, array{name: string, description: string, widgets: list<array{type: string, grid_config?: array<string, array{rows: int, cols: int}>, options?: array<string, mixed>}>}>
     */
    public static function all(): array
    {
        if (null !== self::$override) {
            return self::$override;
        }

        return [
            'editorial' => [
                'name'        => 'Editorial',
                'description' => 'For content-focused users — recent activity, the latest leads, and a snapshot of the site at a glance.',
                'widgets'     => [
                    ['type' => 'keystone.welcome'],
                    ['type' => 'keystone.site-at-a-glance'],
                    ['type' => 'keystone.recent-activity'],
                    ['type' => 'keystone.recent-leads'],
                ],
            ],
            'commerce' => [
                'name'        => 'Commerce',
                'description' => 'For store operators — orders KPI, revenue trend, recent orders, inventory alerts, and the order-status breakdown.',
                'widgets'     => [
                    [
                        'type'    => 'keystone.kpi-tile',
                        'options' => ['metric' => 'orders'],
                    ],
                    ['type' => 'keystone.revenue-trend'],
                    ['type' => 'keystone.recent-orders'],
                    ['type' => 'keystone.inventory-alerts'],
                    ['type' => 'keystone.order-status'],
                ],
            ],
            'minimal' => [
                'name'        => 'Minimal',
                'description' => 'A barebones starting point with just the welcome card and the site overview.',
                'widgets'     => [
                    ['type' => 'keystone.welcome'],
                    ['type' => 'keystone.site-at-a-glance'],
                ],
            ],
        ];
    }

    /**
     * Fetch a single starter blueprint by slug, or `null` if unknown.
     *
     * @return array{name: string, description: string, widgets: list<array{type: string, grid_config?: array<string, array{rows: int, cols: int}>, options?: array<string, mixed>}>}|null
     */
    public static function find(string $slug): ?array
    {
        return self::all()[$slug] ?? null;
    }

    /**
     * Replace the starter blueprints for the duration of a test. Pair with
     * `reset()` in `tearDown()` so leftover state doesn't bleed into
     * neighboring tests.
     *
     * @param  array<string, array{name: string, description: string, widgets: list<array{type: string, grid_config?: array<string, array{rows: int, cols: int}>, options?: array<string, mixed>}>}>  $starters
     */
    public static function fake(array $starters): void
    {
        self::$override = $starters;
    }

    /**
     * Clear any test override and fall back to the real starters.
     */
    public static function reset(): void
    {
        self::$override = null;
    }
}
