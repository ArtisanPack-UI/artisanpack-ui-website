<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Dashboard;
use App\Models\User;
use App\Services\UserDashboardService;
use App\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface;
use App\Support\DashboardStarters;
use ArtisanPackUI\CMSFramework\Modules\AdminWidgets\Services\AdminWidgetManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Throwable;

/**
 * Renders the customizable per-user admin dashboard.
 *
 * Responsibilities:
 *  - Resolve the active `Dashboard` (default-for-user, or by slug)
 *  - Hydrate each stored widget instance via its server-side `getData()`
 *  - Skip instances whose `type` is no longer registered (orphan behavior)
 *  - Filter the catalog the frontend uses to add new widgets by user capability
 *
 * The persistence side lives in `UserDashboardService`; the type registry
 * lives in the framework's `AdminWidgetManager` (registered by
 * `DashboardWidgetServiceProvider`).
 */
class DashboardController extends Controller
{
    public function __construct(
        private readonly UserDashboardService $dashboards,
        private readonly AdminWidgetManager $widgets,
    ) {}

    /**
     * Default dashboard for the current user (auto-seeded on first visit).
     */
    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return $this->renderDashboard($user, $this->dashboards->getDefaultForUser($user));
    }

    /**
     * Specific dashboard by slug. Falls back to the default if the slug
     * doesn't match one the user owns — keeps a deleted-or-renamed link
     * from 404'ing the entire shell.
     */
    public function show(Request $request, string $slug): Response
    {
        /** @var User $user */
        $user = $request->user();

        $dashboard = $user->dashboards()->where('slug', $slug)->first()
            ?? $this->dashboards->getDefaultForUser($user);

        return $this->renderDashboard($user, $dashboard);
    }

    /**
     * `GET /admin/dashboards` — convenience entry point that redirects to the
     * user's default dashboard. Mirrors what `/admin` already does, but lets
     * UI code link to a stable URL that doesn't depend on whether the default
     * slug has changed.
     */
    public function dashboardsIndex(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        return redirect()->route('admin.dashboards.show', [
            'slug' => $this->dashboards->getDefaultForUser($user)->slug,
        ]);
    }

    /**
     * Render the Manage dashboards page — the panel with rename, set-default,
     * delete, and drag-reorder for the switcher position. Each row includes
     * the dashboard's widget count so the UI can warn about deletes that take
     * a populated dashboard with them.
     */
    public function manage(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        $dashboards = $user->dashboards()->orderBy('position')->get()->map(
            fn (Dashboard $dashboard): array => array_merge(
                $this->dashboardSummary($dashboard),
                ['widget_count' => count($this->widgets($dashboard))],
            ),
        )->all();

        return Inertia::render('admin/dashboards/Manage', [
            'dashboards' => $dashboards,
        ]);
    }

    /**
     * Create a new (empty) dashboard for the user and redirect to its show
     * page. The new dashboard starts empty, so the show page renders the
     * starter picker — keeping the create-modal flow simple and consistent
     * with the first-login experience.
     */
    public function store(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'name'       => ['required', 'string', 'max:120'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        $dashboard = $this->dashboards->create(
            $user,
            $data['name'],
            (bool) ($data['is_default'] ?? false),
        );

        return redirect()->route('admin.dashboards.show', ['slug' => $dashboard->slug]);
    }

    /**
     * Rename a dashboard and/or promote it to the user's default. Both fields
     * are optional so the UI can issue partial updates (an inline rename
     * doesn't need to know the current default state). At least one of
     * `name` or `is_default` must be provided.
     */
    public function update(Request $request, string $slug): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            // `filled` (not `nullable`) on a `sometimes` rule rejects an
            // explicit empty string. Without it, `name => ''` passes
            // validation here and then trips an `InvalidArgumentException`
            // inside `UserDashboardService::rename()` — a 500, not a 422.
            'name'       => ['sometimes', 'filled', 'string', 'max:120'],
            // `accepted` rejects an explicit falsy `is_default`. This
            // endpoint only supports promotion — a user always has exactly
            // one default, so demotion happens implicitly when another
            // dashboard is promoted, and a `false` payload would otherwise
            // no-op silently and look like a successful update.
            'is_default' => ['sometimes', 'accepted'],
        ]);

        // Normalize the accepted value to a real `true`. `accepted` permits
        // truthy strings like "1"/"yes"/"on" too, but downstream we want a
        // strict boolean so the promotion branch is unambiguous.
        if (array_key_exists('is_default', $data)) {
            $data['is_default'] = true;
        }

        if (! array_key_exists('name', $data) && ! array_key_exists('is_default', $data)) {
            throw ValidationException::withMessages([
                'name' => 'Provide a new name or set the default flag.',
            ]);
        }

        $dashboard = $user->dashboards()->where('slug', $slug)->first();

        if (null === $dashboard) {
            abort(404, 'Dashboard not found.');
        }

        if (array_key_exists('name', $data)) {
            $this->dashboards->rename($dashboard, $data['name']);
        }

        // `is_default => false` is a no-op: a user always has exactly one
        // default, so demotion is implicit when another dashboard is promoted.
        // Trying to *clear* the default would leave the user with zero
        // defaults, which `getDefaultForUser()` would then auto-promote on
        // the next read — better to reject the intent than silently flip.
        if (true === ($data['is_default'] ?? null)) {
            $this->dashboards->setDefault($dashboard);
        }

        return redirect()->route('admin.dashboards.manage');
    }

    /**
     * Delete a dashboard. The service rejects deleting the user's last
     * remaining dashboard with a `RuntimeException`; surface that as a 422
     * with a field-keyed error so the manage UI can render it inline.
     */
    public function destroy(Request $request, string $slug): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $dashboard = $user->dashboards()->where('slug', $slug)->first();

        if (null === $dashboard) {
            abort(404, 'Dashboard not found.');
        }

        try {
            $this->dashboards->delete($dashboard);
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages([
                'dashboard' => $e->getMessage(),
            ]);
        }

        return redirect()->route('admin.dashboards.manage');
    }

    /**
     * Reorder the user's dashboards to match the given ID list. The payload
     * must reference every dashboard the user owns — any missing or extra
     * IDs trip a 422 so a buggy client surfaces the bug instead of silently
     * dropping rows out of the switcher.
     */
    public function reorder(Request $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'order'   => ['required', 'array'],
            'order.*' => ['required', 'integer'],
        ]);

        $ownedIds = $user->dashboards()->pluck('id')->all();
        $owned    = array_flip(array_map('intval', $ownedIds));

        $orderedIds = array_map('intval', $data['order']);

        if (count($orderedIds) !== count($owned)) {
            abort(422, 'Reorder payload must include every dashboard.');
        }

        $seen = [];

        foreach ($orderedIds as $id) {
            if (! isset($owned[$id]) || isset($seen[$id])) {
                abort(422, 'Reorder payload references unknown or duplicate dashboard IDs.');
            }

            $seen[$id] = true;
        }

        $this->dashboards->reorder($user, $orderedIds);

        return redirect()->route('admin.dashboards.manage');
    }

    /**
     * Clone the named starter's widgets into the dashboard identified by
     * $slug. Each spec runs through `AdminWidgetManager::createWidget()` so
     * the materialized instance gets a fresh UUID and the default grid_config
     * from the widget's `getWidgetInfo()`. Per-spec `grid_config` and
     * `options` overrides are shallow-merged on top.
     *
     * Capability filtering is applied here, not at the picker layer — the
     * picker always shows the full starter list, and any widgets the current
     * user can't access are silently dropped at apply time. A starter that
     * yields zero applicable widgets still redirects normally, leaving the
     * dashboard empty (and the picker visible again on the next render).
     */
    public function applyStarter(Request $request, string $slug): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'starter' => ['required', 'string'],
        ]);

        $blueprint = DashboardStarters::find($data['starter']);

        if (null === $blueprint) {
            abort(404, 'Unknown starter.');
        }

        $dashboard = $user->dashboards()->where('slug', $slug)->first();

        if (null === $dashboard) {
            abort(404, 'Dashboard not found.');
        }

        $allowed = array_flip(array_keys($this->widgets->getAvailableWidgetsForUser($user)));

        foreach ($blueprint['widgets'] as $spec) {
            $type = $spec['type'] ?? null;

            if (! is_string($type) || ! isset($allowed[$type])) {
                continue;
            }

            $widget = $this->widgets->createWidget($type);

            if (null === $widget) {
                continue;
            }

            $this->applyWidgetClassDefaults($widget);

            if (isset($spec['grid_config']) && is_array($spec['grid_config'])) {
                $widget['grid_config'] = array_replace($widget['grid_config'], $spec['grid_config']);
            }

            if (isset($spec['options']) && is_array($spec['options'])) {
                $widget['options'] = array_replace($widget['options'], $spec['options']);
            }

            $this->dashboards->addWidget($dashboard, $widget);
        }

        return redirect()->route('admin.dashboards.show', ['slug' => $dashboard->slug]);
    }

    /**
     * Append a widget instance to the dashboard identified by $slug. The
     * widget `type` must be registered AND present in the user's capability-
     * filtered catalog — checking both guards a tampered request from
     * materializing a type the user shouldn't see in the picker.
     */
    public function storeWidget(Request $request, string $slug): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'type' => ['required', 'string'],
        ]);

        $dashboard = $user->dashboards()->where('slug', $slug)->first();

        if (null === $dashboard) {
            abort(404, 'Dashboard not found.');
        }

        $allowed = $this->widgets->getAvailableWidgetsForUser($user);

        if (! isset($allowed[$data['type']])) {
            abort(403, 'Widget type not available.');
        }

        $widget = $this->widgets->createWidget($data['type']);

        if (null === $widget) {
            abort(422, 'Widget type could not be instantiated.');
        }

        $this->applyWidgetClassDefaults($widget);

        $widget['order'] = count($this->widgets($dashboard));

        $this->dashboards->addWidget($dashboard, $widget);

        return redirect()->route('admin.dashboards.show', ['slug' => $dashboard->slug]);
    }

    /**
     * Reorder the dashboard's widgets to match the given ID list. The full
     * current widget set must be passed — `UserDashboardService::reorderWidgets()`
     * drops anything missing from the list, so a partial payload would silently
     * delete widgets. Cross-dashboard or unknown IDs are rejected outright
     * rather than skipped so a buggy client surfaces a 422 instead of silently
     * dropping its own widgets.
     */
    public function reorderWidgets(Request $request, string $slug): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'order'   => ['required', 'array'],
            'order.*' => ['required', 'string'],
        ]);

        $dashboard = $user->dashboards()->where('slug', $slug)->first();

        if (null === $dashboard) {
            abort(404, 'Dashboard not found.');
        }

        $existingIds = [];

        foreach ($this->widgets($dashboard) as $widget) {
            $id = $widget['id'] ?? null;

            if (is_string($id)) {
                $existingIds[$id] = true;
            }
        }

        $orderedIds = $data['order'];

        if (count($orderedIds) !== count($existingIds)) {
            abort(422, 'Reorder payload must include every widget on the dashboard.');
        }

        $seen = [];

        foreach ($orderedIds as $id) {
            if (! isset($existingIds[$id]) || isset($seen[$id])) {
                abort(422, 'Reorder payload references unknown or duplicate widget IDs.');
            }

            $seen[$id] = true;
        }

        $this->dashboards->reorderWidgets($dashboard, $orderedIds);

        return redirect()->route('admin.dashboards.show', ['slug' => $dashboard->slug]);
    }

    /**
     * Validate and persist a settings-modal save for a single widget instance.
     * Options are validated against the widget's declared `settings_schema`
     * (unknown keys are rejected; types are coerced where safe) and then
     * shallow-merged into the instance's existing `options` bag.
     */
    public function updateWidget(Request $request, string $slug, string $id): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $dashboard = $user->dashboards()->where('slug', $slug)->first();

        if (null === $dashboard) {
            abort(404, 'Dashboard not found.');
        }

        $instance = null;

        foreach ($this->widgets($dashboard) as $widget) {
            if (($widget['id'] ?? null) === $id) {
                $instance = $widget;

                break;
            }
        }

        if (null === $instance) {
            abort(404, 'Widget not found on this dashboard.');
        }

        $type = is_string($instance['type'] ?? null) ? $instance['type'] : '';

        $allowed = $this->widgets->getAvailableWidgetsForUser($user);

        if ('' === $type || ! isset($allowed[$type])) {
            abort(403, 'Widget type not available.');
        }

        $schema = $this->settingsSchemaFor($type);

        if (null === $schema) {
            abort(422, 'Widget has no editable settings.');
        }

        $rawOptions = $request->input('options');

        if (null === $rawOptions) {
            $rawOptions = [];
        }

        if (! is_array($rawOptions)) {
            throw ValidationException::withMessages([
                'options' => 'The options field must be an object.',
            ]);
        }

        $validated = $this->validateOptionsAgainstSchema($schema, $rawOptions);

        $currentOptions = is_array($instance['options'] ?? null) ? $instance['options'] : [];

        $this->dashboards->updateWidget($dashboard, $id, [
            'options' => array_replace($currentOptions, $validated),
        ]);

        return redirect()->route('admin.dashboards.show', ['slug' => $dashboard->slug]);
    }

    /**
     * Replace a widget instance's per-breakpoint `grid_config` (cols/rows for
     * sm/md/lg/xl) with the validated payload. Pass `reset: true` instead of
     * a `grid_config` map to restore the widget class's registered defaults.
     *
     * Validation pulls the expected breakpoint keys from the widget's
     * registered `default_grid_config` (falling back to the framework
     * defaults applied to a fresh instance) so a widget that ever ships a
     * different breakpoint set automatically validates against its own shape.
     */
    public function updateWidgetLayout(Request $request, string $slug, string $id): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $dashboard = $user->dashboards()->where('slug', $slug)->first();

        if (null === $dashboard) {
            abort(404, 'Dashboard not found.');
        }

        $instance = null;

        foreach ($this->widgets($dashboard) as $widget) {
            if (($widget['id'] ?? null) === $id) {
                $instance = $widget;

                break;
            }
        }

        if (null === $instance) {
            abort(404, 'Widget not found on this dashboard.');
        }

        $type = is_string($instance['type'] ?? null) ? $instance['type'] : '';

        $allowed = $this->widgets->getAvailableWidgetsForUser($user);

        if ('' === $type || ! isset($allowed[$type])) {
            abort(403, 'Widget type not available.');
        }

        $breakpoints = $this->layoutBreakpointsFor($type);

        if ($request->boolean('reset')) {
            $defaults = $this->defaultGridConfigFor($type);

            // `defaultGridConfigFor()` returns an empty array on resolution
            // failures (broken widget class, throwing `extendedInfo()`, etc).
            // Persisting that would leave the instance with an invalid shape
            // and crash subsequent renders — surface a 422 so the popover can
            // tell the user instead of silently corrupting the widget.
            if ([] === $defaults) {
                abort(422, 'Widget layout defaults could not be resolved.');
            }

            $this->dashboards->updateWidget($dashboard, $id, [
                'grid_config' => $defaults,
            ]);

            return redirect()->route('admin.dashboards.show', ['slug' => $dashboard->slug]);
        }

        $rules = ['grid_config' => ['required', 'array']];

        foreach ($breakpoints as $bp) {
            $rules['grid_config.'.$bp]         = ['required', 'array'];
            $rules['grid_config.'.$bp.'.cols'] = ['required', 'integer', 'between:1,12'];
            $rules['grid_config.'.$bp.'.rows'] = ['required', 'integer', 'between:1,6'];
        }

        $validated = $request->validate($rules);

        $grid = [];

        foreach ($breakpoints as $bp) {
            $grid[$bp] = [
                'cols' => (int) $validated['grid_config'][$bp]['cols'],
                'rows' => (int) $validated['grid_config'][$bp]['rows'],
            ];
        }

        $this->dashboards->updateWidget($dashboard, $id, [
            'grid_config' => $grid,
        ]);

        return redirect()->route('admin.dashboards.show', ['slug' => $dashboard->slug]);
    }

    /**
     * Remove a widget instance by ID. No-op when the ID isn't on the
     * dashboard so racing tabs don't surface a confusing error.
     */
    public function destroyWidget(Request $request, string $slug, string $id): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $dashboard = $user->dashboards()->where('slug', $slug)->first();

        if (null === $dashboard) {
            abort(404, 'Dashboard not found.');
        }

        $this->dashboards->removeWidget($dashboard, $id);

        return redirect()->route('admin.dashboards.show', ['slug' => $dashboard->slug]);
    }

    private function renderDashboard(User $user, Dashboard $current): Response
    {
        $dashboards = $user->dashboards()->orderBy('position')->get();

        // Ensure `$current` appears in the switcher list even if a stale slug
        // race-conditioned around `getDefaultForUser()` after the query above.
        if (! $dashboards->contains('id', $current->id)) {
            $dashboards->push($current);
        }

        $availableWidgets = $this->availableWidgetsPayload($user);
        $registeredTypes  = array_keys($this->widgets->getAvailableWidgets());
        $allowedTypes     = array_keys($availableWidgets);

        $hydratedWidgets = $this->hydrateWidgets($user, $current, $registeredTypes, $allowedTypes);

        return Inertia::render('admin/Dashboard', [
            'dashboards' => $dashboards->map(fn (Dashboard $dashboard): array => $this->dashboardSummary($dashboard))->all(),
            'current'    => array_merge(
                $this->dashboardSummary($current),
                ['widgets' => $hydratedWidgets],
            ),
            'available_widgets' => $availableWidgets,
            'starters'          => $this->startersPayload(),
        ]);
    }

    /**
     * Shape the starter blueprints for the React picker. The slug is hoisted
     * onto each entry so the frontend can POST it back without round-tripping
     * the array key, and the widgets list is normalized to the
     * `DashboardStarter` TS shape (`type` / `grid_config` / `options`).
     *
     * @return list<array{slug: string, name: string, description: string, widgets: list<array{type: string, grid_config?: array<string, mixed>, options?: array<string, mixed>}>}>
     */
    private function startersPayload(): array
    {
        $payload = [];

        foreach (DashboardStarters::all() as $slug => $starter) {
            $payload[] = [
                'slug'        => $slug,
                'name'        => $starter['name'],
                'description' => $starter['description'],
                'widgets'     => array_values(array_map(
                    static fn (array $spec): array => array_filter(
                        [
                            'type'        => $spec['type'] ?? '',
                            'grid_config' => $spec['grid_config'] ?? null,
                            'options'     => $spec['options'] ?? null,
                        ],
                        static fn ($value): bool => null !== $value,
                    ),
                    $starter['widgets'],
                )),
            ];
        }

        return $payload;
    }

    /**
     * @param  list<string>  $registeredTypes  Every registered widget type (orphan filter).
     * @param  list<string>  $allowedTypes  Types the current user has capability for.
     *
     * @return list<array<string, mixed>>
     */
    private function hydrateWidgets(User $user, Dashboard $dashboard, array $registeredTypes, array $allowedTypes): array
    {
        $registered = array_flip($registeredTypes);
        $allowed    = array_flip($allowedTypes);
        $hydrated   = [];

        foreach ($this->widgets($dashboard) as $instance) {
            $type = $instance['type'] ?? null;

            if (! is_string($type) || ! isset($registered[$type]) || ! isset($allowed[$type])) {
                continue;
            }

            // Resolve the widget class from the registry by type rather than
            // trusting the persisted `component_class`. A tampered JSON row
            // can't redirect hydration at a different class this way; the
            // server-side type→class binding remains authoritative. The whole
            // resolve-and-hydrate path runs inside the per-instance try/catch
            // so a broken registry entry downgrades the single widget rather
            // than failing the entire dashboard render.
            $class = null;

            try {
                $sample = $this->widgets->createWidget($type);
                $class  = $sample['component_class'] ?? null;

                if (! is_string($class) || ! class_exists($class) || ! is_subclass_of($class, KeystoneAdminWidgetInterface::class)) {
                    continue;
                }

                $options          = is_array($instance['options'] ?? null) ? $instance['options'] : [];
                $instance['data'] = $class::getData($user, $options);
            } catch (Throwable $e) {
                // A buggy widget shouldn't take down the whole dashboard. Log
                // and emit an `error` flag so the React side can render a
                // per-widget failure state instead of crashing the page.
                Log::error('Dashboard widget hydration threw an exception.', [
                    'type'      => $type,
                    'class'     => $class,
                    'exception' => $e,
                ]);

                $instance['data']  = [];
                $instance['error'] = true;
            }

            $hydrated[] = $instance;
        }

        return $hydrated;
    }

    /**
     * Build the `available_widgets` payload: framework info merged with the
     * Keystone `extendedInfo()` (component key + settings_schema). Capability
     * filtering is delegated to the framework manager.
     *
     * @return array<string, array<string, mixed>>
     */
    private function availableWidgetsPayload(User $user): array
    {
        $available = $this->widgets->getAvailableWidgetsForUser($user);
        $payload   = [];

        foreach ($available as $type => $info) {
            $class = null;

            try {
                $sample = $this->widgets->createWidget($type);
                $class  = $sample['component_class'] ?? null;

                if (! is_string($class) || ! class_exists($class) || ! is_subclass_of($class, KeystoneAdminWidgetInterface::class)) {
                    continue;
                }

                $extendedInfo = $class::extendedInfo();

                // `component` is the React-side identifier the Add Widget
                // drawer needs to render anything useful. A catalog entry
                // without it would surface as a broken option, so drop the
                // entire type rather than ship an unrenderable row.
                if (! isset($extendedInfo['component']) || ! is_string($extendedInfo['component'])) {
                    continue;
                }

                $info = array_merge($info, $extendedInfo);

                // `source` groups widgets in the Add Widget drawer (Keystone
                // core vs. each plugin). Default to "keystone" so widgets
                // that don't set one still land under a sensible heading.
                if (! isset($info['source']) || ! is_string($info['source']) || '' === $info['source']) {
                    $info['source'] = 'keystone';
                }
            } catch (Throwable $e) {
                // Drop the broken type from the catalog. Isolating the
                // registry lookup inside the same try means a broken
                // registry entry can't take down the catalog either.
                Log::error('Dashboard widget extendedInfo() threw an exception.', [
                    'type'      => $type,
                    'class'     => $class,
                    'exception' => $e,
                ]);

                continue;
            }

            $payload[$type] = $info;
        }

        return $payload;
    }

    /**
     * @return array{id: int, name: string, slug: string, is_default: bool, position: int}
     */
    private function dashboardSummary(Dashboard $dashboard): array
    {
        return [
            'id'         => $dashboard->id,
            'name'       => $dashboard->name,
            'slug'       => $dashboard->slug,
            'is_default' => (bool) $dashboard->is_default,
            'position'   => (int) $dashboard->position,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function widgets(Dashboard $dashboard): array
    {
        return is_array($dashboard->widgets) ? array_values($dashboard->widgets) : [];
    }

    /**
     * Apply the widget class's per-breakpoint `default_grid_config` from
     * `extendedInfo()` (if declared) on top of the framework's hard-coded
     * defaults. Runs before per-spec overrides so a starter blueprint or
     * stored instance can still tighten the layout.
     *
     * Failures are logged and swallowed — a broken `extendedInfo()` should
     * leave the widget on framework defaults rather than reject the add.
     *
     * @param  array<string, mixed>  $widget  Mutated in place.
     */
    private function applyWidgetClassDefaults(array &$widget): void
    {
        $class = $widget['component_class'] ?? null;

        if (! is_string($class) || ! class_exists($class) || ! is_subclass_of($class, KeystoneAdminWidgetInterface::class)) {
            return;
        }

        try {
            $extendedInfo = $class::extendedInfo();
        } catch (Throwable $e) {
            Log::warning('Dashboard widget extendedInfo() threw while applying class defaults.', [
                'class'     => $class,
                'exception' => $e,
            ]);

            return;
        }

        $defaults = $extendedInfo['default_grid_config'] ?? null;

        if (! is_array($defaults)) {
            return;
        }

        $widget['grid_config'] = array_replace(
            is_array($widget['grid_config'] ?? null) ? $widget['grid_config'] : [],
            $defaults,
        );
    }

    /**
     * Resolve the `settings_schema.fields` list for a widget type. Returns
     * `null` when the widget either isn't registered, doesn't expose a
     * `settings_schema`, or declares an empty schema (which is the signal the
     * frontend uses to hide the Edit gear in the first place).
     *
     * @return list<array<string, mixed>>|null
     */
    private function settingsSchemaFor(string $type): ?array
    {
        try {
            $sample = $this->widgets->createWidget($type);
        } catch (Throwable $e) {
            Log::error('Dashboard widget settings_schema lookup threw an exception.', [
                'type'      => $type,
                'exception' => $e,
            ]);

            return null;
        }

        if (null === $sample) {
            return null;
        }

        $class = $sample['component_class'] ?? null;

        if (! is_string($class) || ! class_exists($class) || ! is_subclass_of($class, KeystoneAdminWidgetInterface::class)) {
            return null;
        }

        try {
            $extended = $class::extendedInfo();
        } catch (Throwable $e) {
            Log::error('Dashboard widget extendedInfo() threw during schema lookup.', [
                'type'      => $type,
                'class'     => $class,
                'exception' => $e,
            ]);

            return null;
        }

        $schema = $extended['settings_schema'] ?? null;

        if (! is_array($schema)) {
            return null;
        }

        $fields = $schema['fields'] ?? null;

        if (! is_array($fields) || [] === $fields) {
            return null;
        }

        $normalized = [];

        foreach ($fields as $field) {
            if (is_array($field) && is_string($field['name'] ?? null) && is_string($field['type'] ?? null)) {
                $normalized[] = $field;
            }
        }

        return [] === $normalized ? null : $normalized;
    }

    /**
     * Validate $options against $schema. Unknown keys are rejected; values
     * are coerced to the field's declared type where the input is
     * unambiguous. Throws Laravel `ValidationException` so the caller surfaces
     * a 422 with field-keyed errors the modal can render.
     *
     * @param  list<array<string, mixed>>  $schema
     * @param  array<string, mixed>  $options
     *
     * @return array<string, mixed>
     */
    private function validateOptionsAgainstSchema(array $schema, array $options): array
    {
        $known = [];

        foreach ($schema as $field) {
            $known[$field['name']] = $field;
        }

        $unknown = array_diff(array_keys($options), array_keys($known));

        if ([] !== $unknown) {
            throw ValidationException::withMessages([
                'options' => 'Unknown option: '.implode(', ', $unknown),
            ]);
        }

        $resolved = [];
        $errors   = [];

        foreach ($schema as $field) {
            $name = $field['name'];
            $type = $field['type'];
            $key  = 'options.'.$name;

            if (! array_key_exists($name, $options)) {
                continue;
            }

            $value = $options[$name];

            switch ($type) {
                case 'text':
                    if (! is_string($value) && null !== $value) {
                        $errors[$key][] = 'The '.$name.' field must be a string.';

                        break;
                    }

                    $resolved[$name] = null === $value ? '' : $value;

                    break;

                case 'number':
                    if (is_string($value) && is_numeric($value)) {
                        $value += 0;
                    }

                    if (! is_int($value) && ! is_float($value)) {
                        $errors[$key][] = 'The '.$name.' field must be a number.';

                        break;
                    }

                    $coerced = is_float($value) && (float) (int) $value === $value ? (int) $value : $value;

                    if (isset($field['min']) && is_numeric($field['min']) && $coerced < (float) $field['min']) {
                        $errors[$key][] = 'The '.$name.' field must be at least '.$field['min'].'.';

                        break;
                    }

                    if (isset($field['max']) && is_numeric($field['max']) && $coerced > (float) $field['max']) {
                        $errors[$key][] = 'The '.$name.' field must not exceed '.$field['max'].'.';

                        break;
                    }

                    $resolved[$name] = $coerced;

                    break;

                case 'toggle':
                    if (is_bool($value)) {
                        $resolved[$name] = $value;

                        break;
                    }

                    $coerced = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

                    if (null === $coerced) {
                        $errors[$key][] = 'The '.$name.' field must be a boolean.';

                        break;
                    }

                    $resolved[$name] = $coerced;

                    break;

                case 'select':
                    if (! is_string($value) && ! is_int($value)) {
                        $errors[$key][] = 'The '.$name.' field must be a string.';

                        break;
                    }

                    $coerced       = (string) $value;
                    $allowedValues = $this->selectAllowedValues($field);

                    if ([] !== $allowedValues && ! in_array($coerced, $allowedValues, true)) {
                        $errors[$key][] = 'The selected '.$name.' is invalid.';

                        break;
                    }

                    $resolved[$name] = $coerced;

                    break;

                case 'multiselect':
                    if (! is_array($value)) {
                        $errors[$key][] = 'The '.$name.' field must be an array.';

                        break;
                    }

                    $allowedValues = $this->selectAllowedValues($field);
                    $cleaned       = [];

                    foreach ($value as $entry) {
                        if (! is_string($entry) && ! is_int($entry)) {
                            continue;
                        }

                        $entry = (string) $entry;

                        if ([] !== $allowedValues && ! in_array($entry, $allowedValues, true)) {
                            continue;
                        }

                        $cleaned[] = $entry;
                    }

                    $resolved[$name] = array_values(array_unique($cleaned));

                    break;

                default:
                    // Unknown field type — refuse rather than persist an
                    // unvetted blob. Schemas should be authored against the
                    // documented v1 type list.
                    $errors[$key][] = 'The '.$name.' field has an unsupported type.';

                    break;
            }
        }

        if ([] !== $errors) {
            throw ValidationException::withMessages($errors);
        }

        return $resolved;
    }

    /**
     * Resolve the per-breakpoint `grid_config` a fresh widget of $type would
     * receive: framework defaults merged with the widget class's declared
     * `default_grid_config`. Returns an empty array if the type can't be
     * instantiated, which forces the layout endpoint to surface a validation
     * error rather than persisting a half-broken config.
     *
     * @return array<string, array{cols: int, rows: int}>
     */
    private function defaultGridConfigFor(string $type): array
    {
        try {
            $widget = $this->widgets->createWidget($type);
        } catch (Throwable $e) {
            Log::error('Dashboard widget default_grid_config lookup threw an exception.', [
                'type'      => $type,
                'exception' => $e,
            ]);

            return [];
        }

        if (null === $widget) {
            return [];
        }

        $this->applyWidgetClassDefaults($widget);

        $config = $widget['grid_config'] ?? [];

        if (! is_array($config)) {
            return [];
        }

        $normalized = [];

        foreach ($config as $bp => $entry) {
            if (! is_string($bp) || ! is_array($entry)) {
                continue;
            }

            $cols = $entry['cols'] ?? null;
            $rows = $entry['rows'] ?? null;

            if (! is_numeric($cols) || ! is_numeric($rows)) {
                continue;
            }

            $normalized[$bp] = ['cols' => (int) $cols, 'rows' => (int) $rows];
        }

        return $normalized;
    }

    /**
     * Breakpoint keys the layout editor must cover for widgets of $type. Pulled
     * from the widget's registered `default_grid_config` so the validation
     * shape always matches the same widget's render shape; falls back to the
     * v1 breakpoint quartet for widgets that don't declare their own.
     *
     * @return list<string>
     */
    private function layoutBreakpointsFor(string $type): array
    {
        $defaults    = $this->defaultGridConfigFor($type);
        $breakpoints = array_values(array_filter(array_keys($defaults), 'is_string'));

        return [] === $breakpoints ? ['sm', 'md', 'lg', 'xl'] : $breakpoints;
    }

    /**
     * Pull the allowed scalar values out of a `select`/`multiselect` field's
     * `options` declaration. Supports the list-of-`{value,label}` shape used
     * across existing widgets; returns an empty list when no constraint is
     * declared so validation falls back to "any string is acceptable".
     *
     * @param  array<string, mixed>  $field
     *
     * @return list<string>
     */
    private function selectAllowedValues(array $field): array
    {
        $options = $field['options'] ?? null;

        if (! is_array($options)) {
            return [];
        }

        $values = [];

        foreach ($options as $option) {
            if (is_array($option) && isset($option['value']) && (is_string($option['value']) || is_int($option['value']))) {
                $values[] = (string) $option['value'];
            }
        }

        return $values;
    }
}
