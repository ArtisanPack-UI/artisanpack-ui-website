import { applyFilters } from '@artisanpack-ui/hooks-js';

/**
 * Filterable replacement for `window.confirm(message)`. Runs the prompt
 * through `keystone.admin.confirm` first so a plugin can swap the raw
 * browser dialog for a themed one, auto-approve destructive actions in
 * a test harness, or veto without showing anything at all.
 *
 * The filter callback receives `(null, { message })` and should return:
 *
 * - `true` — approve without showing the browser dialog (custom UI has
 *   already confirmed the intent, or the action is auto-approved).
 * - `false` — veto without showing the browser dialog. Caller should
 *   treat this identically to the user clicking Cancel.
 * - `null` / `undefined` — fall through to the built-in `window.confirm`
 *   so the browser dialog still shows. This is the default (a no-op
 *   filter returns the initial `null`).
 *
 * Kept synchronous on purpose — every existing caller was `window.confirm`
 * and rewriting them all to async would ripple through Inertia `router`
 * calls in the same tick. A plugin that needs an async modal (e.g. an
 * artisanpack-ui themed dialog) can render its own component ahead of
 * the destructive action and use the imperative result to bypass this
 * helper entirely.
 */
export function keystoneConfirm(message: string): boolean {
    const decision = applyFilters<boolean | null>('keystone.admin.confirm', null, { message });
    if (typeof decision === 'boolean') {
        return decision;
    }
    if (typeof window === 'undefined') {
        return false;
    }
    return window.confirm(message);
}
