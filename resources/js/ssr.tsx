import { createInertiaApp } from '@inertiajs/react';
import createServer from '@inertiajs/react/server';
import ReactDOMServer from 'react-dom/server';
import type { ComponentType } from 'react';
import { ThemeProvider } from '@artisanpack-ui/react';

import type { FederatedModuleManifest } from '@/lib/plugins/federated-loader';
import { buildPageMap, pageNotFoundError } from '@/lib/resolve-page';

const fallbackAppName = import.meta.env.VITE_APP_NAME || 'Laravel';

// Mirrors `app.tsx` exactly — same two glob roots, same shared key derivation
// and duplicate guard. Hoisted to module scope so the eager glob is flattened
// once at bundle load rather than on every rendered page. Divergence between
// the two entries is the classic way an SSR render 500s on a page the client
// resolves fine, which is why both go through `buildPageMap`
// (plans/14-modular-laravel-setup.md §3.4).
const pages = buildPageMap(
    import.meta.glob<{ default: ComponentType<Record<string, unknown>> }>('./pages/**/*.tsx', {
        eager: true,
    }),
    import.meta.glob<{ default: ComponentType<Record<string, unknown>> }>(
        '../../Modules/*/resources/js/pages/**/*.tsx',
        { eager: true },
    ),
);

/**
 * A no-op placeholder for federated plugin pages during server-side render.
 *
 * Plugin bundles ship as runtime-loaded Module Federation remotes — the
 * server has no way to import them without shipping every plugin's JS into
 * the SSR bundle. Rather than throw during SSR (which would break the
 * initial HTML response for any page a plugin owns), we render nothing on
 * the server and let the client-side `resolve` fallback hydrate the real
 * page after `virtual:__federation__` loads.
 */
const FederatedSsrPlaceholder = (): null => null;

createServer((page) => {
    const props     = page.props as {
        name?: string;
        keystone?: { federatedModules?: FederatedModuleManifest };
    };
    const sharedName = props.name;
    const appName    = sharedName || fallbackAppName;
    const federated  = props.keystone?.federatedModules?.pages ?? {};

    return createInertiaApp({
        page,
        render: ReactDOMServer.renderToString,
        title: (title) => (title ? `${title} - ${appName}` : appName),
        resolve: (name) => {
            const found = pages[name];
            if (found) {
                return found;
            }

            if (federated[name]) {
                return { default: FederatedSsrPlaceholder };
            }

            throw pageNotFoundError(name);
        },
        setup: ({ App, props }) => (
            <ThemeProvider defaultColorScheme="system">
                <App {...props} />
            </ThemeProvider>
        ),
    });
});
