import { lazy, type ComponentType } from 'react';
import { applyFilters, doAction } from '@artisanpack-ui/hooks-js';
import { loadFederatedPage, type FederatedModuleEntry } from './federated-loader';

/**
 * Bounded LRU cache of `React.lazy()` component wrappers keyed by
 * `remote::module::entry` — the SAME key the underlying
 * `loadFederatedPage()` uses, so this cache and the loader's own
 * `pageCache` stay in lockstep. The lazy factory only fires the
 * underlying `loadFederatedPage()` call once per key; entries evicted
 * from this cache are re-created on next resolve without re-fetching
 * the bundle because the loader's cache still has it.
 *
 * Bounded so a long-lived admin session that watches a plugin rebuild
 * many times doesn't accumulate one dead lazy wrapper per historical
 * `remoteEntry.js` hash for the SPA's lifetime.
 */
const CACHE_LIMIT = 32;
const cache = new Map<string, ComponentType<Record<string, unknown>>>();

/**
 * Resolve a federated module descriptor into a lazy React component
 * ready to render inside a Suspense boundary. Callers must render the
 * returned component under an error boundary — a load failure surfaces
 * as an error thrown from render, which React routes to the nearest
 * boundary.
 *
 * Sharing this helper between the full-page Inertia resolver
 * (`resources/js/app.tsx`) and edit-screen panels
 * (`resources/js/components/admin/panels/AdminEditSlot.tsx`) keeps
 * both surfaces on a single cache — a plugin that rebuilds its remote
 * URL invalidates one cache, not two, and page + panel bundles from
 * the same remote never fight each other's eviction path.
 *
 * Plugin extension seams (#152):
 * - `keystone.admin.plugins.federatedPage.beforeMount` action fires
 *   inside the lazy factory the moment the bundle resolves, before
 *   React commits the component to the tree. Useful for lazy-loading
 *   companion assets (a plugin-owned stylesheet, a translations file).
 * - `keystone.admin.plugins.federatedPage.loadError` filter runs when
 *   `loadFederatedPage()` rejects; subscribers can transform the error
 *   (e.g. wrap in a plugin-branded exception) or short-circuit by
 *   returning a synthetic module. Fallthrough (returning the original
 *   error) keeps the standard rethrow-into-nearest-error-boundary path.
 * - `keystone.admin.plugins.federatedPage.wrap` filter wraps the
 *   resolved component so a subscriber can inject an HOC (feature-flag
 *   gate, tracking wrapper, layout override) around a plugin page.
 */
export function resolveFederatedComponent(
    entry: FederatedModuleEntry,
): ComponentType<Record<string, unknown>> {
    const key = `${entry.remote}::${entry.module}::${entry.entry}`;
    const cached = cache.get(key);
    if (cached) {
        // Bump recency by re-inserting at the tail of the Map iter order.
        cache.delete(key);
        cache.set(key, cached);
        return cached;
    }

    const Component = lazy(async () => {
        let loaded;
        try {
            loaded = await loadFederatedPage(entry);
        } catch (error) {
            const failure = error instanceof Error ? error : new Error(String(error));
            // Filter subscribers can return either a `default: Component`
            // to short-circuit into a synthetic module or `null` /
            // `undefined` to preserve the throw-into-boundary path.
            const outcome = applyFilters<
                { default: ComponentType<Record<string, unknown>> } | null
            >('keystone.admin.plugins.federatedPage.loadError', null, {
                error: failure,
                entry,
            });
            if (outcome && typeof outcome === 'object' && 'default' in outcome) {
                return outcome;
            }
            throw failure;
        }

        doAction('keystone.admin.plugins.federatedPage.beforeMount', entry, loaded);

        const Inner = loaded.default as unknown as ComponentType<Record<string, unknown>>;
        const Wrapped = applyFilters<ComponentType<Record<string, unknown>>>(
            'keystone.admin.plugins.federatedPage.wrap',
            Inner,
            { entry },
        );

        return { default: Wrapped };
    });

    cache.set(key, Component);
    evictOldest();

    return Component;
}

function evictOldest(): void {
    while (cache.size > CACHE_LIMIT) {
        const oldestKey = cache.keys().next().value;
        if (undefined === oldestKey) {
            return;
        }
        cache.delete(oldestKey);
    }
}

/**
 * Clear the resolver cache. Exposed for test cleanup and for the
 * plugin-manifest hot-swap path when a plugin's entry URL changes
 * mid-session and callers want to force a full re-resolution.
 */
export function clearFederatedComponentCache(): void {
    cache.clear();
}
