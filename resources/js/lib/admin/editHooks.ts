import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { router } from '@inertiajs/react';
import { applyFilters, doAction } from '@artisanpack-ui/hooks-js';

/**
 * Reusable JS hook-fanout helpers for admin Edit screens. Every helper
 * fires BOTH `keystone.admin.edit.*` (generic) AND
 * `keystone.admin.{resource}.edit.*` (resource-scoped) variants so a
 * plugin can subscribe once for every edit screen or narrow to one
 * resource. Import into individual `Edit.tsx` pages instead of hand-
 * rolling the fire sites, so the emit conventions stay consistent as
 * screens are added.
 *
 * NOTE: The existing `keystone.admin.{resource}.edit.form.beforeSubmit`
 * filter is fired inline by the pages themselves (see posts/Edit.tsx) —
 * this file focuses on the extended fanout added in #143.
 */

type Ctx = { resource: string; id: string | number | null };

/**
 * `.edit.form.state` — fires on every render with the current form
 * state so plugins can mirror it (autosave draft, live preview). Args:
 * `(state, ctx)`. Not a filter — rewriting state from a plugin would
 * fight the local `useState` write path.
 */
export function useEditFormState<T>(resource: string, id: Ctx['id'], state: T): void {
    // Deep-compare via JSON on the changed reference to skip firing on
    // no-op re-renders. Cheap for the typical form (a flat object of
    // primitives); large forms should call `doAction` directly instead
    // of using this helper.
    const previous = useRef<string | null>(null);
    useEffect(() => {
        const serialized = safeStringify(state);
        if (previous.current === serialized) return;
        previous.current = serialized;
        doAction('keystone.admin.edit.form.state', state, { resource, id });
        doAction(`keystone.admin.${resource}.edit.form.state`, state, { resource, id });
    }, [state, resource, id]);
}

/**
 * `.edit.form.validate` — filters the client-side error map before
 * it's rendered. Plugins can inject cross-field validation the server
 * won't see until submit. Args: `(errors, { state, ...ctx })`. Return
 * the (possibly rewritten) error map.
 */
export function useEditFormValidate<T>(
    resource: string,
    id: Ctx['id'],
    state: T,
    errors: Record<string, string>,
): Record<string, string> {
    return useMemo(
        () => applyFilters<Record<string, string>>(
            `keystone.admin.${resource}.edit.form.validate`,
            applyFilters<Record<string, string>>(
                'keystone.admin.edit.form.validate',
                errors,
                { state, resource, id },
            ),
            { state, resource, id },
        ),
        [state, errors, resource, id],
    );
}

/**
 * `.edit.form.dirty` — fires when the dirty status transitions
 * (false → true or vice versa). Plugins can gate a Save button, warn
 * on navigation, or stamp a "Modified" indicator. Args:
 * `(isDirty, ctx)`.
 */
export function useEditFormDirty(
    resource: string,
    id: Ctx['id'],
    isDirty: boolean,
): void {
    const previous = useRef<boolean | null>(null);
    useEffect(() => {
        if (previous.current === isDirty) return;
        previous.current = isDirty;
        doAction('keystone.admin.edit.form.dirty', isDirty, { resource, id });
        doAction(`keystone.admin.${resource}.edit.form.dirty`, isDirty, { resource, id });
    }, [isDirty, resource, id]);
}

/**
 * `.edit.leaveConfirm` — filters the confirmation message shown when
 * a dirty form is about to unmount (route change / tab close). Plugins
 * can localize the message or replace it. Args:
 * `(string | null, { isDirty, resource, id })`; return `null` to skip
 * the confirmation entirely.
 *
 * Covers two navigation modes:
 *  1. **Native browser unload** (refresh, tab close, external URL) —
 *     wired via `beforeunload`. Browsers ignore custom messages on
 *     modern engines but honour the prompt itself.
 *  2. **Inertia client-side navigation** (Link click, `router.visit`,
 *     `router.put`, `router.delete`) — wired via `router.on('before',
 *     …)`. Inertia does NOT trigger `beforeunload` for SPA navigation,
 *     so without this second listener a dirty form would silently
 *     lose changes on a `<Link>` click. Uses `window.confirm` so the
 *     filter's custom message is shown verbatim (unlike `beforeunload`).
 *     Browser history / popstate cannot be cancelled by any listener —
 *     that's a browser policy — so the confirmation only covers user-
 *     initiated visits.
 */
export function useEditLeaveConfirm(
    resource: string,
    id: Ctx['id'],
    isDirty: boolean,
    defaultMessage = 'You have unsaved changes. Leave anyway?',
): void {
    useEffect(() => {
        const filtered = applyFilters<string | null>(
            `keystone.admin.${resource}.edit.leaveConfirm`,
            applyFilters<string | null>(
                'keystone.admin.edit.leaveConfirm',
                isDirty ? defaultMessage : null,
                { isDirty, resource, id },
            ),
            { isDirty, resource, id },
        );
        if (!filtered) return;
        function warn(e: BeforeUnloadEvent): void {
            e.preventDefault();
            e.returnValue = filtered!;
        }
        window.addEventListener('beforeunload', warn);
        const removeInertia = router.on('before', (event) => {
            // Skip the confirm for non-GET visits — Inertia fires
            // `before` for the form's own `router.put` / `router.delete`
            // submits, and prompting there would ask the user to
            // confirm their own Save / Delete action.
            const visitMethod = (event.detail.visit.method ?? 'get').toString().toLowerCase();
            if ('get' !== visitMethod) {
                return;
            }
            if (!window.confirm(filtered)) {
                event.preventDefault();
            }
        });
        return () => {
            window.removeEventListener('beforeunload', warn);
            removeInertia();
        };
    }, [isDirty, defaultMessage, resource, id]);
}

/**
 * `.edit.form.submit` — fires from the submit callback right before
 * the network write happens. Complements the earlier
 * `.edit.form.beforeSubmit` filter (which is the veto point); this
 * action fires only once the payload has cleared the veto chain.
 * Args: `(payload, ctx)`.
 */
export function fireEditFormSubmit<P>(resource: string, id: Ctx['id'], payload: P): void {
    doAction('keystone.admin.edit.form.submit', payload, { resource, id });
    doAction(`keystone.admin.${resource}.edit.form.submit`, payload, { resource, id });
}

/**
 * `.edit.form.success` — fires on a successful save response (the
 * `onSuccess` branch of Inertia's request options). Args:
 * `(response, ctx)`.
 */
export function fireEditFormSuccess<R>(resource: string, id: Ctx['id'], response: R): void {
    doAction('keystone.admin.edit.form.success', response, { resource, id });
    doAction(`keystone.admin.${resource}.edit.form.success`, response, { resource, id });
}

/**
 * `.edit.form.error` — fires on a failed save (`onError`). Args:
 * `(errors, ctx)`. `errors` matches Inertia's error shape (keys are
 * field names, values are strings).
 */
export function fireEditFormError(
    resource: string,
    id: Ctx['id'],
    errors: Record<string, string>,
): void {
    doAction('keystone.admin.edit.form.error', errors, { resource, id });
    doAction(`keystone.admin.${resource}.edit.form.error`, errors, { resource, id });
}

/**
 * `.edit.delete` — filter fired right before a delete confirmation is
 * dispatched. Return `false` to veto (silent — the caller is
 * responsible for user feedback the same way `.edit.form.beforeSubmit`
 * works). Args: `(record, ctx)`.
 */
export function applyEditDelete<T>(resource: string, id: Ctx['id'], record: T): T | false {
    const generic = applyFilters<T | false>(
        'keystone.admin.edit.delete',
        record,
        { resource, id },
    );
    if (false === generic) return false;
    return applyFilters<T | false>(
        `keystone.admin.${resource}.edit.delete`,
        generic,
        { resource, id },
    );
}

/**
 * `.edit.deleted` — fires after a delete completes (the `onSuccess`
 * branch of the delete request). Args: `(record, ctx)`.
 */
export function fireEditDeleted<T>(resource: string, id: Ctx['id'], record: T): void {
    doAction('keystone.admin.edit.deleted', record, { resource, id });
    doAction(`keystone.admin.${resource}.edit.deleted`, record, { resource, id });
}

/**
 * `.edit.fields` — filter over the list of field descriptors the edit
 * screen intends to render. Plugins can inject additional fields, hide
 * built-ins behind a role gate, or rewrite labels. The concrete shape
 * of a "field" is caller-defined; this helper only threads the filter
 * chain.
 * Args: `(fields, { resource, id })`.
 */
export function useEditFields<F>(resource: string, id: Ctx['id'], fields: F[]): F[] {
    return useMemo(
        () => applyFilters<F[]>(
            `keystone.admin.${resource}.edit.fields`,
            applyFilters<F[]>('keystone.admin.edit.fields', fields, { resource, id }),
            { resource, id },
        ),
        [fields, resource, id],
    );
}

/**
 * `.edit.field.render` — per-field render wrapper so plugins can
 * decorate (help-chip, permission gate) or replace the rendered
 * field. Args: `(ReactNode, { field, resource, id })`.
 */
export function applyEditFieldRender<F>(
    resource: string,
    id: Ctx['id'],
    field: F,
    node: ReactNode,
): ReactNode {
    const generic = applyFilters<ReactNode>(
        'keystone.admin.edit.field.render',
        node,
        { field, resource, id },
    );
    return applyFilters<ReactNode>(
        `keystone.admin.${resource}.edit.field.render`,
        generic,
        { field, resource, id },
    );
}

function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch {
        return '[unserializable]';
    }
}
