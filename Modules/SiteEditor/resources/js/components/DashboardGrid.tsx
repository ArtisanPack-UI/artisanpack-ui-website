import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    rectSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import type { CSSProperties, ReactNode } from 'react';
import { Widget as WidgetChrome } from '@/components/admin/keystone';
import { resolveWidget } from '@/lib/admin/widget-registry';
import { widgetHasSettings } from './WidgetSettingsModal';
import type { AvailableWidget, AvailableWidgets, Widget, WidgetGridConfig } from '@/types/keystone';

const BREAKPOINTS = ['sm', 'md', 'lg', 'xl'] as const;
type Breakpoint = (typeof BREAKPOINTS)[number];

/**
 * Clamp a stored col span into the 1–12 grid. Persisted dashboards may have
 * been edited by an older version of the editor with a different range, so
 * the grid renderer is the single source of truth for valid spans.
 */
function clampCols(cols: number): number {
    if (!Number.isFinite(cols)) {
        return 12;
    }
    return Math.min(12, Math.max(1, Math.trunc(cols)));
}

/**
 * Clamp a stored row span into the 1–6 range the layout editor accepts.
 * Mirrors `clampCols` so an older or tampered persisted value can't crash
 * the renderer or emit a class Tailwind hasn't pre-generated.
 */
function clampRows(rows: number): number {
    if (!Number.isFinite(rows)) {
        return 1;
    }
    return Math.min(6, Math.max(1, Math.trunc(rows)));
}

/**
 * Translate a `grid_config` into the Tailwind class string for the wrapper
 * div. The exhaustive list of `{bp}:{col,row}-span-{N}` classes is declared
 * in `resources/css/app.css` via `@source inline(...)` so Tailwind v4
 * doesn't purge them.
 *
 * Mobile (no prefix) always spans the full 12 cols and a single row — widgets
 * stack one per row on the narrowest screens and pick up their stored spans
 * at `sm` and above.
 */
export function gridConfigToClasses(config: Widget['grid_config']): string {
    // The Widget type guarantees every breakpoint entry, but a tampered or
    // partially-migrated JSON row in the DB can still arrive here missing
    // a key. Treat missing entries as a 12×1 cell instead of throwing — a
    // crashed renderer would take down the entire dashboard for what should
    // be a per-widget data problem.
    const safe = config as Partial<Record<Breakpoint, Partial<WidgetGridConfig>>>;
    return [
        'col-span-12',
        'row-span-1',
        ...BREAKPOINTS.map((bp) => `${bp}:col-span-${clampCols(Number(safe[bp]?.cols))}`),
        ...BREAKPOINTS.map((bp) => `${bp}:row-span-${clampRows(Number(safe[bp]?.rows))}`),
    ].join(' ');
}

interface DashboardGridProps {
    widgets: Widget[];
    availableWidgets: AvailableWidgets;
    /**
     * Invoked when the user clicks a widget's remove control. Optional so the
     * grid stays renderable in contexts (e.g. read-only previews) that don't
     * want to expose the action.
     */
    onRemoveWidget?: (widgetId: string, widgetTitle: string) => void;
    /**
     * Invoked with the new ID order after a drag-drop. Optional so contexts
     * that don't want to expose reordering (read-only previews, tests) can
     * render the grid without wiring drag persistence.
     */
    onReorderWidgets?: (orderedIds: string[]) => void;
    /**
     * Invoked with the widget ID when the user clicks the Edit (gear) icon.
     * The chrome only renders the gear when both this callback is provided
     * and the widget's catalog entry declares a `settings_schema`.
     */
    onEditWidget?: (widgetId: string) => void;
    /**
     * Invoked with the widget ID when the user clicks the Layout (resize)
     * icon. The chrome renders the icon whenever this callback is provided,
     * since every widget has an editable `grid_config` regardless of whether
     * it declares content settings.
     */
    onEditLayout?: (widgetId: string) => void;
}

/**
 * Widgets may self-collapse by emitting `data.visible === false` from
 * `getData()`. The renderer skips them for that load without removing the
 * instance from persistence, so the next check that resolves to "visible"
 * re-introduces the widget at its stored position. The Keystone update
 * banner is the first consumer of this contract.
 */
function isSelfCollapsed(widget: Widget): boolean {
    const data = widget.data;
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    return (data as { visible?: unknown }).visible === false;
}

/**
 * Filter a widget list down to the ones the grid would actually render:
 * the widget's `type` must be in the available-widgets catalog AND its
 * `component` key must be registered. Exported so the page can decide
 * whether to show the empty state — `current.widgets.length` alone is
 * misleading because the grid silently skips orphans and self-collapsed
 * instances.
 */
export function renderableWidgets(widgets: Widget[], availableWidgets: AvailableWidgets): Widget[] {
    return widgets.filter((widget) => {
        const catalog: AvailableWidget | undefined = availableWidgets[widget.type];
        if (!catalog) {
            return false;
        }
        if (resolveWidget(catalog.component) === null) {
            return false;
        }
        return !isSelfCollapsed(widget);
    });
}

export function DashboardGrid({ widgets, availableWidgets, onRemoveWidget, onReorderWidgets, onEditWidget, onEditLayout }: DashboardGridProps) {
    // `activationConstraint.distance` prevents the handle's `click` action
    // from being eaten by a phantom drag whenever a user just wants to focus
    // it via mouse — the keyboard sensor handles the same intent for a11y.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) {
            return;
        }

        const oldIndex = widgets.findIndex((widget) => widget.id === active.id);
        const newIndex = widgets.findIndex((widget) => widget.id === over.id);

        if (-1 === oldIndex || -1 === newIndex) {
            return;
        }

        const reordered = arrayMove(widgets, oldIndex, newIndex);
        onReorderWidgets?.(reordered.map((widget) => widget.id));
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={widgets.map((widget) => widget.id)} strategy={rectSortingStrategy}>
                <div className="grid auto-rows-fr grid-cols-12 gap-7">
                    {widgets.map((widget) => {
                        const catalog: AvailableWidget | undefined = availableWidgets[widget.type];
                        if (!catalog) {
                            return null;
                        }

                        const Component = resolveWidget(catalog.component);
                        if (!Component) {
                            return null;
                        }

                        if (isSelfCollapsed(widget)) {
                            return null;
                        }

                        // Built-in widget body — either the error placeholder
                        // (when the payload set `.error`) or the resolved
                        // component. Run it through `.dashboard.widget.render`
                        // so a plugin can wrap / decorate / replace the
                        // rendered body without forking the grid (e.g.
                        // an ErrorBoundary wrapper, an "unsaved changes"
                        // overlay for the widget being edited, a locked
                        // pane for a permission-gated widget). Args:
                        // `(ReactNode, { widget, catalog })`. Return `null`
                        // to hide the body while keeping the widget chrome.
                        const defaultBody: ReactNode = widget.error ? (
                            <div className="grid h-32 place-items-center text-sm text-base-content/55">
                                This widget couldn&apos;t load.
                            </div>
                        ) : (
                            <Component
                                widget={widget}
                                data={widget.data}
                                options={widget.options}
                            />
                        );

                        const body = applyFilters<ReactNode>(
                            'keystone.admin.dashboard.widget.render',
                            defaultBody,
                            { widget, catalog },
                        );

                        return (
                            <SortableWidget
                                key={widget.id}
                                widget={widget}
                                onRemove={onRemoveWidget}
                                onEdit={onEditWidget && widgetHasSettings(catalog) ? onEditWidget : undefined}
                                onEditLayout={onEditLayout}
                                draggable={Boolean(onReorderWidgets)}
                                isDemo={Boolean(catalog.is_demo)}
                            >
                                {body}
                            </SortableWidget>
                        );
                    })}
                </div>
            </SortableContext>
        </DndContext>
    );
}

interface SortableWidgetProps {
    widget: Widget;
    onRemove?: (widgetId: string, widgetTitle: string) => void;
    /**
     * Invoked when the chrome's Edit (gear) icon is clicked. Only set by
     * `DashboardGrid` when the widget's catalog entry declares a
     * `settings_schema`, so the gear is invisible for unconfigurable widgets.
     */
    onEdit?: (widgetId: string) => void;
    /**
     * Invoked when the chrome's Layout (resize) icon is clicked. Optional —
     * read-only previews omit it to keep the chrome free of action affordances
     * the surface doesn't actually support.
     */
    onEditLayout?: (widgetId: string) => void;
    /**
     * When false the drag handle is hidden and dnd-kit's transform/transition
     * styles are skipped. Lets callers render the grid read-only without
     * the chrome implying a non-existent reorder gesture.
     */
    draggable: boolean;
    /**
     * When true the chrome header shows a small "Demo data" pill — surfaces
     * widgets that are still backed by `KeystoneSampleData` until their
     * parent feature lands and wires real data.
     */
    isDemo: boolean;
    children: React.ReactNode;
}

function SortableWidget({ widget, onRemove, onEdit, onEditLayout, draggable, isDemo, children }: SortableWidgetProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: widget.id,
        disabled: !draggable,
    });

    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        // Lift the dragged widget above its neighbours so the drop-target
        // outline doesn't draw over its translucent overlay.
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.85 : undefined,
    };

    const actions = (
        <>
            {isDemo && (
                <span
                    className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-warning"
                    title="This widget is still backed by sample data."
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                    Demo data
                </span>
            )}
            {draggable && (
                <button
                    type="button"
                    aria-label={`Reorder ${widget.title}`}
                    className="cursor-grab rounded-md p-1 text-base-content/55 hover:bg-base-200/60 hover:text-base-content focus-visible:cursor-grabbing active:cursor-grabbing"
                    {...attributes}
                    {...listeners}
                >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
                        <path
                            d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            )}
            {onEditLayout && (
                <button
                    type="button"
                    aria-label={`Edit ${widget.title} layout`}
                    className="rounded-md p-1 text-base-content/55 hover:bg-base-200/60 hover:text-base-content"
                    onClick={() => onEditLayout(widget.id)}
                >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
                        <path
                            d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </button>
            )}
            {onEdit && (
                <button
                    type="button"
                    aria-label={`Edit ${widget.title}`}
                    className="rounded-md p-1 text-base-content/55 hover:bg-base-200/60 hover:text-base-content"
                    onClick={() => onEdit(widget.id)}
                >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
                        <path
                            d="M10.325 4.317a1.724 1.724 0 0 1 3.35 0c.155.715.928 1.107 1.6.815a1.724 1.724 0 0 1 2.37 2.37c-.293.673.1 1.446.815 1.6a1.724 1.724 0 0 1 0 3.35c-.715.155-1.107.928-.815 1.6a1.724 1.724 0 0 1-2.37 2.37c-.673-.293-1.446.1-1.6.815a1.724 1.724 0 0 1-3.35 0c-.155-.715-.928-1.107-1.6-.815a1.724 1.724 0 0 1-2.37-2.37c.293-.673-.1-1.446-.815-1.6a1.724 1.724 0 0 1 0-3.35c.715-.155 1.107-.928.815-1.6a1.724 1.724 0 0 1 2.37-2.37c.673.293 1.446-.1 1.6-.815z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                </button>
            )}
            {onRemove && (
                <button
                    type="button"
                    aria-label={`Remove ${widget.title}`}
                    className="rounded-md p-1 text-base-content/55 hover:bg-base-200/60 hover:text-error"
                    onClick={() => onRemove(widget.id, widget.title)}
                >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
                        <path
                            d="M6 6l12 12M18 6 6 18"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            )}
        </>
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`h-full ${gridConfigToClasses(widget.grid_config)}`}
        >
            <WidgetChrome
                title={widget.title}
                action={actions}
                className={`h-full ${colorSchemeClass(widget.color_scheme)}`}
            >
                {children}
            </WidgetChrome>
        </div>
    );
}

/**
 * Map a daisyUI/Tailwind color token (e.g. `base-100`, `primary`) to the
 * matching background class. The persisted value is restricted by the
 * widget settings modal (separate sub-issue) so an unknown token here just
 * falls back to the default card background.
 *
 * The mapping uses literal class strings so Tailwind's content scanner
 * picks every entry up — `bg-${scheme}` template-string forms aren't
 * statically extractable, and the rarer tokens (`bg-secondary`, `bg-info`,
 * etc.) don't appear literally anywhere else in the codebase, so they'd be
 * purged from the build otherwise.
 */
const COLOR_SCHEME_CLASSES: Record<string, string> = {
    'base-100': 'bg-base-100',
    'base-200': 'bg-base-200',
    'base-300': 'bg-base-300',
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    accent: 'bg-accent',
    neutral: 'bg-neutral',
    info: 'bg-info',
    success: 'bg-success',
    warning: 'bg-warning',
    error: 'bg-error',
};

function colorSchemeClass(scheme: string): string {
    return COLOR_SCHEME_CLASSES[scheme] ?? '';
}

// `WidgetGridConfig` is re-exported so widget definitions that need to surface
// breakpoint-specific defaults can lean on the same shape the grid consumes.
export type { Breakpoint, WidgetGridConfig };
