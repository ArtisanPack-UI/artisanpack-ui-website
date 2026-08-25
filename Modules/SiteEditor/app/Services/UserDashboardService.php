<?php

declare(strict_types=1);

namespace Modules\SiteEditor\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Modules\SiteEditor\Models\Dashboard;
use Modules\Users\Models\User;
use RuntimeException;

/**
 * Persistence-layer service for user-owned dashboards (issue #71/#72).
 *
 * Owns the invariants the database can't enforce: single-default-per-user,
 * per-user slug uniqueness with collision suffixes, monotonic `position`
 * during reorder, and the array-mutation helpers for the JSON `widgets`
 * column. Controllers should call this rather than touching the model
 * directly so the invariants stay in one place.
 */
class UserDashboardService
{
    /**
     * Resolve the user's default dashboard. If they have none, seed a blank
     * "Overview" dashboard and mark it as default. If they have dashboards
     * but none is flagged default (e.g. legacy data, or the previous default
     * was deleted), promote the lowest-position one.
     *
     * Race-safe: the seed/promote branch runs inside a transaction with a
     * row-level lock on the user, so two concurrent first-login requests
     * can't both pass the empty-check and insert duplicate "overview" rows
     * (which would trip the per-user slug unique constraint).
     */
    public function getDefaultForUser(User $user): Dashboard
    {
        $default = $user->dashboards()->where('is_default', true)->first();

        if (null !== $default) {
            return $default;
        }

        return DB::transaction(function () use ($user): Dashboard {
            // Lock the user row so the seed/promote branch serializes per
            // user — cheaper than locking the dashboards table and avoids
            // gap locks on the unique slug index under MySQL's REPEATABLE
            // READ.
            User::query()->whereKey($user->getKey())->lockForUpdate()->first();

            $default = $user->dashboards()->where('is_default', true)->first();

            if (null !== $default) {
                return $default;
            }

            $existing = $user->dashboards()->orderBy('position')->first();

            if (null !== $existing) {
                $existing->forceFill(['is_default' => true])->save();

                return $existing;
            }

            return $user->dashboards()->create([
                'name'       => 'Overview',
                'slug'       => 'overview',
                'is_default' => true,
                'position'   => 0,
                'widgets'    => [],
            ]);
        });
    }

    /**
     * Create a new dashboard for the user. Generates a per-user-unique slug,
     * appends it to the switcher (last `position`), and optionally promotes
     * it to default. Wrapped in a transaction so the new row and the
     * default-promotion can't end in an inconsistent state.
     */
    public function create(User $user, string $name, bool $makeDefault = false): Dashboard
    {
        $name = trim($name);

        if ('' === $name) {
            throw new InvalidArgumentException('Dashboard name cannot be empty.');
        }

        return DB::transaction(function () use ($user, $name, $makeDefault): Dashboard {
            // Lock the user row so concurrent creates don't race the slug
            // collision check (mirrors `getDefaultForUser()`).
            User::query()->whereKey($user->getKey())->lockForUpdate()->first();

            $nextPosition = (int) ($user->dashboards()->max('position') ?? -1) + 1;

            $dashboard = $user->dashboards()->create([
                'name'       => $name,
                'slug'       => $this->generateUniqueSlug((int) $user->getKey(), $name),
                'is_default' => false,
                'position'   => $nextPosition,
                'widgets'    => [],
            ]);

            if ($makeDefault) {
                return $this->setDefault($dashboard);
            }

            return $dashboard;
        });
    }

    /**
     * Promote $dashboard to the user's default, demoting whatever was
     * previously default. The two writes are wrapped in a transaction so a
     * crash in the middle can't leave the user with zero (or two) defaults.
     */
    public function setDefault(Dashboard $dashboard): Dashboard
    {
        DB::transaction(function () use ($dashboard): void {
            // Serialize concurrent setDefault() calls for the same user so two
            // tabs can't both pass the "demote others" step and end up with
            // multiple defaults flagged.
            User::query()->whereKey($dashboard->user_id)->lockForUpdate()->first();

            Dashboard::query()
                ->where('user_id', $dashboard->user_id)
                ->where('id', '!=', $dashboard->id)
                ->where('is_default', true)
                ->update(['is_default' => false]);

            $dashboard->forceFill(['is_default' => true])->save();
        });

        return $dashboard->refresh();
    }

    /**
     * Rename a dashboard and regenerate its slug. The slug uses
     * `Str::slug($name)` with a numeric collision suffix scoped to the
     * dashboard's owner — e.g. a second "Overview" becomes `overview-2`.
     */
    public function rename(Dashboard $dashboard, string $name): Dashboard
    {
        $name = trim($name);

        if ('' === $name) {
            throw new InvalidArgumentException('Dashboard name cannot be empty.');
        }

        $dashboard->forceFill([
            'name' => $name,
            'slug' => $this->generateUniqueSlug($dashboard->user_id, $name, $dashboard->id),
        ])->save();

        return $dashboard;
    }

    /**
     * Delete a dashboard. If the deleted row was the default, promote the
     * lowest-position remaining dashboard so the user never loses their
     * default pointer. Refuses to delete the user's last dashboard — every
     * user should always have at least one.
     */
    public function delete(Dashboard $dashboard): void
    {
        DB::transaction(function () use ($dashboard): void {
            $remaining = Dashboard::query()
                ->where('user_id', $dashboard->user_id)
                ->where('id', '!=', $dashboard->id)
                ->orderBy('position')
                ->get();

            if ($remaining->isEmpty()) {
                throw new RuntimeException('Cannot delete the user\'s only dashboard.');
            }

            $wasDefault = $dashboard->is_default;
            $dashboard->delete();

            if ($wasDefault) {
                $remaining->first()->forceFill(['is_default' => true])->save();
            }
        });
    }

    /**
     * Reorder the user's dashboards. `$orderedDashboardIds` is the new
     * left-to-right order in the switcher; positions are reassigned 0..N-1.
     * IDs that don't belong to the user are ignored. IDs missing from the
     * list keep whatever position the DB already has — callers should pass
     * the full set to avoid surprises.
     *
     * @param  list<int>  $orderedDashboardIds
     */
    public function reorder(User $user, array $orderedDashboardIds): void
    {
        $ownedIds = $user->dashboards()
            ->whereIn('id', $orderedDashboardIds)
            ->pluck('id')
            ->all();

        $ownedIdLookup = array_flip($ownedIds);

        DB::transaction(function () use ($orderedDashboardIds, $ownedIdLookup): void {
            $position = 0;

            foreach ($orderedDashboardIds as $id) {
                if (! isset($ownedIdLookup[$id])) {
                    continue;
                }

                Dashboard::query()->where('id', $id)->update(['position' => $position]);
                $position++;
            }
        });
    }

    /**
     * Append a widget instance to the dashboard's `widgets` JSON column. The
     * widget shape should match what `AdminWidgetManager::createWidget()`
     * returns — this service doesn't validate the shape, it just persists.
     *
     * @param  array<string, mixed>  $widget
     */
    public function addWidget(Dashboard $dashboard, array $widget): Dashboard
    {
        return $this->mutateWidgets($dashboard, function (array $widgets) use ($widget): array {
            $widgets[] = $widget;

            return $widgets;
        });
    }

    /**
     * Remove the widget with the given instance ID from the dashboard. No-op
     * if no widget matches; doesn't throw because callers (UI deletes) can't
     * always know whether another tab already removed it.
     */
    public function removeWidget(Dashboard $dashboard, string $widgetId): Dashboard
    {
        return $this->mutateWidgets($dashboard, fn (array $widgets): array => array_values(array_filter(
            $widgets,
            fn (array $widget): bool => ($widget['id'] ?? null) !== $widgetId,
        )));
    }

    /**
     * Shallow-merge $changes into the widget with the given ID. The widget's
     * `id` cannot be overwritten — passing `id` in $changes is silently
     * ignored to keep the array stable across reorders.
     *
     * @param  array<string, mixed>  $changes
     */
    public function updateWidget(Dashboard $dashboard, string $widgetId, array $changes): Dashboard
    {
        unset($changes['id']);

        return $this->mutateWidgets($dashboard, fn (array $widgets): array => array_map(
            fn (array $widget): array => ($widget['id'] ?? null) === $widgetId
                ? array_replace($widget, $changes)
                : $widget,
            $widgets,
        ));
    }

    /**
     * Reorder the dashboard's widgets to match the given ID order. Widgets
     * missing from $orderedWidgetIds are dropped from the array — callers
     * doing a drag-reorder should pass the full current set. The `order`
     * field on each widget is rewritten to match the new index so consumers
     * that sort by `order` (not array position) stay consistent.
     *
     * @param  list<string>  $orderedWidgetIds
     */
    public function reorderWidgets(Dashboard $dashboard, array $orderedWidgetIds): Dashboard
    {
        return $this->mutateWidgets($dashboard, function (array $widgets) use ($orderedWidgetIds): array {
            $widgetsById = [];

            foreach ($widgets as $widget) {
                $id = $widget['id'] ?? null;

                if (is_string($id)) {
                    $widgetsById[$id] = $widget;
                }
            }

            $reordered = [];

            foreach ($orderedWidgetIds as $index => $id) {
                if (! isset($widgetsById[$id])) {
                    continue;
                }

                $widget          = $widgetsById[$id];
                $widget['order'] = $index;
                $reordered[]     = $widget;
            }

            return $reordered;
        });
    }

    /**
     * Generate a per-user-unique slug from $name, appending `-2`, `-3`, … on
     * collision. $ignoreId lets callers exclude a dashboard from the check
     * (used by `rename()` so a no-op rename doesn't bump its own suffix).
     */
    private function generateUniqueSlug(int $userId, string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name);

        if ('' === $base) {
            $base = 'dashboard';
        }

        $slug    = $base;
        $suffix  = 2;
        $taken   = Dashboard::query()
            ->where('user_id', $userId)
            ->when(null !== $ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->pluck('slug')
            ->all();
        $lookup = array_flip($taken);

        while (isset($lookup[$slug])) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function widgets(Dashboard $dashboard): array
    {
        return is_array($dashboard->widgets) ? array_values($dashboard->widgets) : [];
    }

    /**
     * Run $mutator against the dashboard's current widgets list inside a
     * transaction with `lockForUpdate()` on the row. Without this, two
     * concurrent widget operations (e.g. two tabs adding widgets at once) can
     * each read the array, mutate independently, and write back — clobbering
     * each other's changes. The lock serializes them so the second waits for
     * the first to commit before reading.
     *
     * @param  callable(list<array<string, mixed>>): list<array<string, mixed>>  $mutator
     */
    private function mutateWidgets(Dashboard $dashboard, callable $mutator): Dashboard
    {
        return DB::transaction(function () use ($dashboard, $mutator): Dashboard {
            $locked = Dashboard::query()
                ->whereKey($dashboard->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $widgets = $mutator($this->widgets($locked));

            $locked->forceFill(['widgets' => array_values($widgets)])->save();

            return $locked;
        });
    }
}
