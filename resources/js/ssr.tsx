import { createInertiaApp } from '@inertiajs/react';
import createServer from '@inertiajs/react/server';
import ReactDOMServer from 'react-dom/server';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@artisanpack-ui/react';

import type { FederatedModuleManifest } from '@/lib/plugins/federated-loader';

const fallbackAppName = import.meta.env.VITE_APP_NAME || 'Laravel';

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
    const federated  = props.keystone?.federatedModules ?? {};

    return createInertiaApp({
        page,
        render: ReactDOMServer.renderToString,
        title: (title) => (title ? `${title} - ${appName}` : appName),
        resolve: (name) => {
            const pages = import.meta.glob<{ default: ReactNode }>('./pages/**/*.tsx', {
                eager: true,
            });
            const found = pages[`./pages/${name}.tsx`];
            if (found) {
                return found;
            }

            if (federated[name]) {
                return { default: FederatedSsrPlaceholder };
            }

            throw new Error(`Inertia page not found: ./pages/${name}.tsx`);
        },
        setup: ({ App, props }) => (
            <ThemeProvider defaultColorScheme="system">
                <App {...props} />
            </ThemeProvider>
        ),
    });
});
