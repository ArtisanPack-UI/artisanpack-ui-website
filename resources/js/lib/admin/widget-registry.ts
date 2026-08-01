import type { ComponentType } from 'react';
import { doAction } from '@artisanpack-ui/hooks-js';
import type { Widget, WidgetOptions } from '@/types/keystone';

export interface WidgetComponentProps<TData = unknown> {
    widget: Widget;
    data: TData;
    options: WidgetOptions;
}

export type WidgetComponent<TData = unknown> = ComponentType<WidgetComponentProps<TData>>;

const registry = new Map<string, WidgetComponent>();

/**
 * Register a React component against a stable widget `component` key. The
 * key comes from the server-side `extendedInfo()['component']` and is what
 * the `available_widgets` catalog ships down to the frontend.
 *
 * Registration is idempotent and silently overwrites — wire each key in
 * exactly once during app boot (see `widgets/index.ts`).
 */
export function registerWidget<TData = unknown>(key: string, component: WidgetComponent<TData>): void {
    // Fire `keystone.admin.dashboard.widget.register` BEFORE the write so
    // observers see the intended registration (and can log / warn on
    // conflicts) even when the pre-existing entry is about to be
    // silently overwritten. Args: `(key, ComponentType)`. Paired with
    // the post-write `.dashboard.widget.registered` action.
    doAction('keystone.admin.dashboard.widget.register', key, component);

    registry.set(key, component as WidgetComponent);

    // Fire `keystone.admin.dashboard.widget.registered` so plugins can
    // enumerate what's available at any point after boot without needing
    // to observe every registration site directly. Args: `(key)`.
    doAction('keystone.admin.dashboard.widget.registered', key);
}

/**
 * Resolve a previously registered widget component. Returns `null` if the
 * key isn't in the registry — the dashboard grid treats this as an orphan
 * and silently skips the instance.
 */
export function resolveWidget(key: string): WidgetComponent | null {
    return registry.get(key) ?? null;
}

/** Test-only escape hatch — never call from production code. */
export function clearWidgetRegistry(): void {
    registry.clear();
}
