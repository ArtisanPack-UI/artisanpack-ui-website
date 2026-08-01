import { router, usePage } from '@inertiajs/react';
import { applyFilters, doAction } from '@artisanpack-ui/hooks-js';

/**
 * Bridge Inertia's router lifecycle events into the shared hooks bus so
 * plugin bootModules can `addAction('keystone.admin.router.start', …)` /
 * `.finish` without needing an Inertia handle themselves.
 *
 * Kept separate from `@/lib/admin/progress` (which also subscribes to the
 * same events) because that module owns the NProgress ref-count and
 * intentionally scopes itself to progress-bearing visits. Hook fanout is
 * global on purpose: a plugin observing `router.start` wants EVERY
 * navigation, including partial reloads that skip the progress bar.
 *
 * The action fires with the raw Inertia visit object. Consumers should
 * treat it as read-only — mutating fields mid-flight is not supported
 * (the visit-options filter in `keystone.admin.router.navigate` is the
 * intended write path).
 */
router.on('start', (event) => {
    doAction('keystone.admin.router.start', event.detail.visit);
});

router.on('finish', (event) => {
    doAction('keystone.admin.router.finish', event.detail.visit);
});

/**
 * Bridge Inertia's `before` event into `keystone.admin.router.navigate` as a
 * filter over the pending visit. Callbacks receive the visit object (URL,
 * method, headers, data, etc.) and return the (possibly mutated) visit;
 * because Inertia treats `event.detail.visit` as the source of truth for
 * fields it reads AFTER the `before` handlers, mutating the returned object
 * in place is the intended write path.
 *
 * Returning `false` from a callback vetoes the navigation entirely — the
 * filter respects the veto contract by short-circuiting the Inertia visit
 * with `event.preventDefault()`. This lets a subscriber (feature-flag
 * gate, unsaved-changes guard) block a navigation without racing the
 * default visit path.
 *
 * MUTATION CONTRACT: subscribers should MUTATE the visit object in place
 * (or return the mutated original). Returning a spread copy works for
 * ADDING or OVERWRITING fields, but CANNOT REMOVE a field — the
 * write-back copies keys from the returned object onto the live visit
 * with `Object.assign`, which never deletes keys that were only present
 * on the original. Plugins that need to clear a header should set it to
 * `undefined` on the live `visit` object directly.
 */
router.on('before', (event) => {
    const visit = event.detail.visit;
    const filtered = applyFilters<typeof visit | false>('keystone.admin.router.navigate', visit);
    if (false === filtered) {
        event.preventDefault();
        return;
    }
    if (filtered !== visit) {
        Object.assign(visit, filtered);
    }
});

/**
 * Read the Inertia page after routing its props through
 * `keystone.admin.pageProps`. Callbacks receive the raw props object and
 * return the (possibly rewritten) props; the page shape (`props`, `url`,
 * `component`, `version`) is otherwise untouched.
 *
 * Use in place of Inertia's `usePage()` when a page-level surface (a
 * form, a header banner) should be susceptible to plugin rewrites of the
 * shared props payload without the page needing to know a plugin is
 * involved. Runs on every render so callbacks bound after mount pick up
 * on the next React commit.
 */
export function useHookedPage<T extends Record<string, unknown> = Record<string, unknown>>() {
    // The generic constraint is intentionally loose — Inertia's own
    // `PageProps` from @inertiajs/core is a narrow shape (errors,
    // deferred) that most Keystone pages don't satisfy verbatim, and
    // pinning to it would reject valid callers. Callers pass their own
    // page-props interface as T.
    const page = usePage<T>();
    const filteredProps = applyFilters<T>('keystone.admin.pageProps', page.props);
    if (filteredProps === page.props) {
        return page;
    }
    return { ...page, props: filteredProps };
}
