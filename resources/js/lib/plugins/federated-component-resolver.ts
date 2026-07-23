import { lazy, type ComponentType } from 'react';
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
        const loaded = await loadFederatedPage(entry);
        return {
            default: loaded.default as unknown as ComponentType<Record<string, unknown>>,
        };
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
