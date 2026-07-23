import type { ComponentType } from 'react';
import type { ContentEditEntry, PanelContext } from './types';

/**
 * Props every panel body receives — the plugin-declared `props` merged
 * with the current content-type + record context.
 */
export type PanelComponentProps = Record<string, unknown> & {
    context: PanelContext;
};

/**
 * Keystone-owned built-in panel registry. Plugin bundles that ship as
 * federated remotes register there instead; this registry is for the
 * host's own reusable panels (custom fields section, etc.) so they can
 * be surfaced through the same slot API plugins use.
 *
 * Backed by `Map` rather than a plain object so a panel component
 * identifier that names an inherited Object property (e.g. `toString`,
 * `constructor`) can't be treated as a built-in registration and shadow
 * what would otherwise resolve as a federated component.
 *
 * Register at import time by calling {@link registerAdminEditPanel} —
 * see `resources/js/lib/admin/panels.ts` for the wiring entry point.
 */
const BUILTIN_PANELS = new Map<string, ComponentType<PanelComponentProps>>();

export function registerAdminEditPanel(
    identifier: string,
    component: ComponentType<PanelComponentProps>,
): void {
    BUILTIN_PANELS.set(identifier, component);
}

export function resolveBuiltinPanel(
    entry: ContentEditEntry,
): ComponentType<PanelComponentProps> | undefined {
    return BUILTIN_PANELS.get(entry.component);
}
