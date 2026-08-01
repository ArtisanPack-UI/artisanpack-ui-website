import type { ComponentType } from 'react';
import { doAction } from '@artisanpack-ui/hooks-js';
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
    // Fire the pre-write `keystone.admin.panels.register` action so plugins
    // can observe registrations as they happen (e.g. to build a plugin →
    // panel index) BEFORE the registry mutation. Paired with the post-write
    // `keystone.admin.panels.registered` action below — the pair mirrors
    // the pre/post shape used elsewhere in the admin so subscribers that
    // need to decorate a component reference can bind to the pre-hook and
    // subscribers that just need the completed identifier can bind to the
    // post-hook. Args: `(identifier, component)`.
    doAction('keystone.admin.panels.register', identifier, component);
    BUILTIN_PANELS.set(identifier, component);
    // Fire `keystone.admin.panels.registered` so plugins can enumerate
    // what's available at any point after boot. Args: `(identifier)`.
    doAction('keystone.admin.panels.registered', identifier);
}

export function resolveBuiltinPanel(
    entry: ContentEditEntry,
): ComponentType<PanelComponentProps> | undefined {
    return BUILTIN_PANELS.get(entry.component);
}
