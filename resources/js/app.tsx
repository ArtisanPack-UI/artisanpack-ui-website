// The hooks-js side-effect import MUST come before any module that binds
// actions or filters (widgets registry, plugin boot modules, admin shell
// components). Importing here ensures the shared `ApHooks` singleton is
// initialised on `globalThis` before anything else runs, so a plugin
// bundle loaded via `<script>` or Module Federation can reach the same
// registry the host itself uses.
import '@artisanpack-ui/hooks-js';

import { createInertiaApp, router } from '@inertiajs/react';
import { applyFilters, doAction } from '@artisanpack-ui/hooks-js';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { ThemeProvider } from '@artisanpack-ui/react';

// Registers every admin dashboard widget component into the widget registry
// before any Dashboard page mounts. Import for side-effects only.
import '@/lib/admin/widgets';

// Configures the shared NProgress instance the admin loading bar uses. Import
// for side-effects so the config runs once, before any admin fetch call site.
import '@/lib/admin/progress';

// Bridges Inertia router lifecycle events into the shared hooks bus
// (`keystone.admin.router.start` / `.finish`). Side-effect import.
import '@/lib/admin/hooks';

import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { PluginErrorBoundary } from '@/components/plugins/PluginErrorBoundary';
import { buildPageMap, pageNotFoundError } from '@/lib/resolve-page';
import {
    loadFederatedPage,
    preloadFederatedBootModules,
    type FederatedModuleEntry,
    type FederatedModuleManifest,
    type FederatedPageManifest,
} from '@/lib/plugins/federated-loader';

const fallbackAppName = import.meta.env.VITE_APP_NAME || 'Laravel';

type InitialPagePayload = {
    props?: {
        name?: string;
        keystone?: { federatedModules?: FederatedModuleManifest };
    };
};

/**
 * Parse the server-embedded `data-page` payload once so the site title and
 * the federated-module manifest share a single JSON.parse + try/catch.
 * Reading runs before Inertia's `setup()` receives props, which is why we
 * can't just wait for `usePage()` here.
 */
function readInitialInertiaPage(): InitialPagePayload {
    if (typeof document === 'undefined') {
        return {};
    }
    try {
        const dataPage = document.getElementById('app')?.dataset.page;
        return dataPage ? (JSON.parse(dataPage) as InitialPagePayload) : {};
    } catch {
        return {};
    }
}

const initialPage       = readInitialInertiaPage();
const initialManifest   = initialPage.props?.keystone?.federatedModules;
let appName             = initialPage.props?.name || fallbackAppName;
// #152 — `keystone.admin.plugins.federatedIndex` gives plugins a seam to
// hide / rename / add entries in the federated page routing table before
// Inertia's resolver reads it. Fires on both the initial page manifest
// and every SPA navigation manifest so a subscriber only has to bind
// once. Kept OUTSIDE the setter so the same subscriber chain is reused.
function applyFederatedIndexFilter(
    pages: FederatedPageManifest,
    source: 'initial' | 'navigate',
): FederatedPageManifest {
    return applyFilters<FederatedPageManifest>(
        'keystone.admin.plugins.federatedIndex',
        pages,
        { source },
    );
}
// Start with the raw manifest so `bootAdminShell()` can preload
// federated boot modules first and re-run the filter with plugin
// subscribers bound before Inertia's `resolve` fires for the initial
// page. Without the two-step, the filter would apply at module top
// with an empty subscriber list and the first federated page render
// would miss every plugin's rewrite.
let federatedIndex: FederatedPageManifest = initialManifest?.pages ?? {};

// Keep `federatedIndex` (and the document title source) in sync with the
// manifest the server sends on every SPA navigation. Without this, a plugin
// activated after the initial page load would be unreachable — `resolve`
// closes over `federatedIndex` and would otherwise only ever see the
// manifest captured at boot. A new plugin's boot module is also preloaded
// on navigation so its hook callbacks bind before the next shell render.
//
// `preloadedBootKeys` is RECOMPUTED from the current manifest on every
// navigation rather than monotonically growing. Otherwise a plugin that
// was deactivated (removed from the manifest) and later re-activated
// would still be treated as "already preloaded" — its entry key would
// linger from the earlier session and skip the re-preload it needs.
function bootModuleKey(entry: FederatedModuleEntry): string {
    return `${entry.remote}::${entry.module}::${entry.entry}`;
}
let preloadedBootKeys = new Set<string>(
    (initialManifest?.bootModules ?? []).map(bootModuleKey),
);

router.on('navigate', (event) => {
    const detail   = (event as unknown as { detail?: { page?: InitialPagePayload } }).detail;
    const props    = detail?.page?.props;
    const manifest = props?.keystone?.federatedModules;
    if (manifest) {
        federatedIndex = applyFederatedIndexFilter(manifest.pages, 'navigate');
        // Fresh = present in the new manifest but not in the previous
        // preloaded set. Reassign `preloadedBootKeys` to only what the
        // new manifest declares so a re-activated plugin re-preloads.
        const nextKeys = new Set<string>();
        const fresh: FederatedModuleEntry[] = [];
        for (const entry of manifest.bootModules) {
            const key = bootModuleKey(entry);
            nextKeys.add(key);
            if (!preloadedBootKeys.has(key)) {
                fresh.push(entry);
            }
        }
        preloadedBootKeys = nextKeys;
        if (fresh.length > 0) {
            void preloadFederatedBootModules(fresh);
        }
    }
    if (props?.name) {
        appName = props.name;
    }
});

// Local pages are Vite build-time glob output — hoist to module scope so
// the record is computed once rather than re-referenced per navigation.
// Both globs must be literal for Vite to statically analyse them; the key
// derivation and the duplicate guard live in `buildPageMap` so `ssr.tsx`
// cannot drift from this file (see plans/14-modular-laravel-setup.md §3.4).
const localPages = buildPageMap(
    import.meta.glob<{ default: ComponentType<Record<string, unknown>> }>('./pages/**/*.tsx'),
    import.meta.glob<{ default: ComponentType<Record<string, unknown>> }>(
        '../../Modules/*/resources/js/pages/**/*.tsx',
    ),
);

/**
 * Memoized wrapper cache: `name::entryUrl` → the boundary-and-layout
 * wrapper we hand back to Inertia's resolver. Keying on `entry.entry`
 * invalidates naturally when the plugin swaps bundles (which the loader
 * would already refetch), while keeping the wrapper stable across
 * navigations so back/forward doesn't discard the plugin tree.
 */
const wrappedCache = new Map<string, { default: ComponentType<Record<string, unknown>> }>();

/**
 * Build the boundary-and-layout wrapper for a federated page.
 *
 * The plugin's exported `Inner` component is rendered BENEATH
 * `PluginErrorBoundary`, so any throw during render — including one from
 * a synthetic {@link Inner} we substitute for a load-time failure — is
 * caught by the boundary rather than escaping to the admin shell.
 *
 * `KeystoneAdminLayout` is always used for the Inertia `.layout` slot.
 * We intentionally do NOT forward `Inner.layout`, even though Inertia's
 * convention allows it: the layout function runs ABOVE
 * `PluginErrorBoundary` (Inertia invokes it before mounting the page
 * subtree), so a plugin-supplied layout that throws would take down the
 * whole admin. Plugins that need custom chrome should render it INSIDE
 * their page component.
 */
function buildWrappedFederatedPage(
    name: string,
    entry: FederatedModuleEntry,
    Inner: ComponentType<Record<string, unknown>>,
): { default: ComponentType<Record<string, unknown>> } {
    const Wrapped: ComponentType<Record<string, unknown>> & {
        layout?: (page: ReactNode) => ReactNode;
        displayName?: string;
    } = (props) =>
        createElement(
            PluginErrorBoundary,
            { pluginName: entry.remote, pageName: name },
            createElement(Inner, props),
        );
    Wrapped.displayName = `FederatedPluginPage(${name})`;
    Wrapped.layout      = (page) => createElement(KeystoneAdminLayout, null, page);

    return { default: Wrapped };
}

/**
 * Load a federated plugin page and wrap it in {@link PluginErrorBoundary} +
 * the Keystone admin layout so plugin pages inherit the admin chrome and
 * any render-time crash is scoped to the plugin instead of the shell.
 *
 * Because we `await` the loader here, Inertia's router awaits before
 * committing the navigation — the URL, history, and `router.on('finish')`
 * signal fire only after the plugin bundle is ready or its load failure
 * has been converted into an in-boundary failure component. That closes
 * the "URL flipped but the screen is blank" gap that a synchronous return
 * with a Suspense fallback would leave open.
 *
 * If `loadFederatedPage()` rejects, we substitute a component that throws
 * the load error at render time. Because that throw happens BELOW the
 * boundary constructed in {@link buildWrappedFederatedPage}, the failure
 * surfaces as the plugin-scoped fallback UI instead of a fatal admin-shell
 * error. Failed loads are NOT cached — the loader itself already evicts
 * its own cache entry on rejection, and a retry (user re-navigates, a
 * plugin update lands) should get another chance at a fresh fetch.
 */
async function resolveFederatedPage(
    name: string,
    entry: FederatedModuleEntry,
): Promise<{ default: ComponentType<Record<string, unknown>> }> {
    const cacheKey = `${name}::${entry.entry}`;
    const cached   = wrappedCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    let Inner: ComponentType<Record<string, unknown>>;
    try {
        const module = await loadFederatedPage(entry);
        Inner        = module.default;
    } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));
        const FailedPluginPage: ComponentType<Record<string, unknown>> = () => {
            throw failure;
        };
        FailedPluginPage.displayName = `FederatedPluginLoadFailure(${name})`;
        return buildWrappedFederatedPage(name, entry, FailedPluginPage);
    }

    const wrapped = buildWrappedFederatedPage(name, entry, Inner);
    wrappedCache.set(cacheKey, wrapped);
    return wrapped;
}

/**
 * Boot the admin shell.
 *
 * The initial page's `bootModules` are preloaded BEFORE `createInertiaApp`
 * is invoked so plugin-registered actions/filters bind before Inertia's
 * `resolve` fires and before the shell renders. `keystone.admin.boot` is
 * dispatched with the mounted Inertia app so consumers can grab a
 * one-shot reference to it if they need to imperatively navigate or
 * inspect page props.
 *
 * Preload is bounded by {@link BOOT_MODULE_PRELOAD_TIMEOUT_MS} so a slow
 * or hung plugin `remoteEntry.js` fetch can't block the admin shell from
 * mounting. Plugins whose boot module hasn't resolved by the deadline
 * miss the very first render — their hook callbacks bind whenever the
 * fetch eventually completes (or fails, silently, per the preloader's
 * per-entry catch), and the next React commit picks them up.
 */
const BOOT_MODULE_PRELOAD_TIMEOUT_MS = 3_000;

async function bootAdminShell(): Promise<void> {
    const bootEntries = initialManifest?.bootModules ?? [];
    if (bootEntries.length > 0) {
        await Promise.race([
            preloadFederatedBootModules(bootEntries),
            new Promise<void>((resolve) => window.setTimeout(resolve, BOOT_MODULE_PRELOAD_TIMEOUT_MS)),
        ]);
    }

    // Filter the initial federated index NOW — after boot modules
    // have had a chance to bind their `keystone.admin.plugins.federatedIndex`
    // subscribers, and BEFORE `createInertiaApp` resolves the initial
    // page component. Doing this at module top would fire the filter
    // with no subscribers registered yet, so the first federated page
    // render would miss every plugin's rewrite.
    federatedIndex = applyFederatedIndexFilter(initialManifest?.pages ?? {}, 'initial');

    const app = await createInertiaApp({
        title: (title) => (title ? `${title} - ${appName}` : appName),
        resolve: (name) => {
            // This resolver is async, so it must resolve to the page component
            // itself (`Promise<ReactComponent>`). Inertia v3's `ComponentResolver`
            // type accepts a *synchronous* module record (`{ default: ReactComponent }`)
            // and the runtime unwraps `.default` for you — that is why `ssr.tsx`,
            // which returns synchronously, needs no unwrap. But the type does NOT
            // accept a `Promise<{ default }>` (v2's looser signature did), so unwrap
            // `.default` here rather than returning the module record from the loader.
            const local = localPages[name];
            if (local) {
                return local().then((module) => module.default);
            }

            const entry = federatedIndex[name];
            if (entry) {
                return resolveFederatedPage(name, entry).then((module) => module.default);
            }

            throw pageNotFoundError(name);
        },
        setup({ el, App, props }) {
            const sharedName = (props.initialPage.props as { name?: string }).name;
            if (sharedName) {
                appName = sharedName;
            }
            const sharedManifest = (
                props.initialPage.props as {
                    keystone?: { federatedModules?: FederatedModuleManifest };
                }
            ).keystone?.federatedModules;
            if (sharedManifest) {
                // Setup runs ONCE for the initial page render, so this
                // second application of the filter is still part of the
                // first mount. Marking it `'initial'` (matching the
                // pre-createInertiaApp fire above) keeps subscribers
                // that branch on `source` from mis-classifying the
                // mount as an SPA navigation.
                federatedIndex = applyFederatedIndexFilter(sharedManifest.pages, 'initial');
            }
            // `keystone.admin.providers` runs OUTSIDE the ThemeProvider so a
            // plugin can wrap the whole shell — including the theme
            // context — with its own provider (i18n, analytics context,
            // feature-flag provider, etc.). Default value is the raw
            // <App /> tree; callbacks receive the current node and return
            // the (possibly wrapped) replacement.
            const providerTree = applyFilters<ReactNode>(
                'keystone.admin.providers',
                <App {...props} />,
            );
            const tree = (
                <ThemeProvider defaultColorScheme="system">
                    {providerTree}
                </ThemeProvider>
            );
            if (el.hasChildNodes()) {
                hydrateRoot(el, tree);
                return;
            }
            createRoot(el).render(tree);
        },
        // Inertia's built-in NProgress driver is disabled here — `@/lib/admin/progress`
        // owns the shared `#nprogress` element for BOTH Inertia navigations and the
        // admin manual-fetch API. A single ref-counted coordinator prevents either
        // source from prematurely completing the bar while the other still needs it.
        // Styling and colouring live in `resources/css/app.css`.
        progress: false,
    });

    doAction('keystone.admin.boot', app);
}

void bootAdminShell();
