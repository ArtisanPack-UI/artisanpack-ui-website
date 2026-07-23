import { createInertiaApp, router } from '@inertiajs/react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { ThemeProvider } from '@artisanpack-ui/react';

// Registers every admin dashboard widget component into the widget registry
// before any Dashboard page mounts. Import for side-effects only.
import '@/lib/admin/widgets';

// Configures the shared NProgress instance the admin loading bar uses. Import
// for side-effects so the config runs once, before any admin fetch call site.
import '@/lib/admin/progress';

import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { PluginErrorBoundary } from '@/components/plugins/PluginErrorBoundary';
import {
    loadFederatedPage,
    type FederatedModuleEntry,
    type FederatedModuleManifest,
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

const initialPage = readInitialInertiaPage();
let appName        = initialPage.props?.name || fallbackAppName;
let federatedIndex = initialPage.props?.keystone?.federatedModules ?? {};

// Keep `federatedIndex` (and the document title source) in sync with the
// manifest the server sends on every SPA navigation. Without this, a plugin
// activated after the initial page load would be unreachable — `resolve`
// closes over `federatedIndex` and would otherwise only ever see the
// manifest captured at boot.
router.on('navigate', (event) => {
    const detail = (event as unknown as { detail?: { page?: InitialPagePayload } }).detail;
    const props  = detail?.page?.props;
    if (props?.keystone?.federatedModules) {
        federatedIndex = props.keystone.federatedModules;
    }
    if (props?.name) {
        appName = props.name;
    }
});

// Local pages are Vite build-time glob output — hoist to module scope so
// the record is computed once rather than re-referenced per navigation.
const localPages = import.meta.glob<{ default: ReactNode }>('./pages/**/*.tsx');

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

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) => {
        const local = localPages[`./pages/${name}.tsx`];
        if (local) {
            return local();
        }

        const entry = federatedIndex[name];
        if (entry) {
            return resolveFederatedPage(name, entry);
        }

        throw new Error(`Inertia page not found: ./pages/${name}.tsx`);
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
            federatedIndex = sharedManifest;
        }
        const tree = (
            <ThemeProvider defaultColorScheme="system">
                <App {...props} />
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
