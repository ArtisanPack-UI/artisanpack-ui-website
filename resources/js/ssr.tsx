import { createInertiaApp } from '@inertiajs/react';
import createServer from '@inertiajs/react/server';
import ReactDOMServer from 'react-dom/server';
import type { ReactNode } from 'react';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createServer((page) =>
    createInertiaApp({
        page,
        render: ReactDOMServer.renderToString,
        title: (title) => (title ? `${title} - ${appName}` : appName),
        resolve: (name) => {
            const pages = import.meta.glob<{ default: ReactNode }>('./pages/**/*.tsx', {
                eager: true,
            });
            const found = pages[`./pages/${name}.tsx`];
            if (!found) {
                throw new Error(`Inertia page not found: ./pages/${name}.tsx`);
            }
            return found;
        },
        setup: ({ App, props }) => <App {...props} />,
    }),
);
