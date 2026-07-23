import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import federation from '@originjs/vite-plugin-federation';

/**
 * Module Federation host config for plugin-supplied React pages.
 *
 * Remotes are DYNAMIC — plugin bundles are activated at runtime and registered
 * via `__federation_method_setRemote` from
 * `resources/js/lib/plugins/federated-loader.ts`. The build-time `remotes` list
 * is intentionally empty; the plugin still emits the host-side runtime that
 * exposes the dynamic-registration hooks.
 *
 * Shared singletons pin Keystone's own React runtime and design system so
 * plugin bundles compiled against these packages hydrate into the same
 * instances the admin shell mounts. `requiredVersion` gives plugin authors a
 * compatibility target to declare against.
 *
 * The plugin is only registered for the CLIENT build. Federation's virtual
 * imports are browser-only; including it in the SSR bundle fails Rollup
 * resolution for `__federation_fn_satisfy`. SSR falls back to a no-op
 * placeholder for federated pages (see `resources/js/ssr.tsx`).
 */
function keystoneFederationPlugin() {
    return federation({
        name: 'keystone-host',
        // A stub build-time remote is required so `@originjs/vite-plugin-federation`
        // computes `isHost = !!prodRemote.length && !prodExpose.length` (index.mjs:958)
        // as true. Without it, the host branch that pins shared React/Inertia
        // singletons doesn't fully engage, and a plugin bundle loaded via
        // `__federation_method_setRemote` can end up with its own React copy —
        // the classic "Invalid hook call" from two React instances. The stub
        // is never actually loaded because every real remote is registered at
        // runtime with `__federation_method_setRemote` before being fetched.
        remotes: {
            __keystone_federation_stub: 'noop@about:blank',
        },
        // Each entry pins BOTH `version` (the exact version this host runs)
        // and `requiredVersion` (the range plugin bundles must satisfy to
        // reuse the singleton). Setting an explicit `version` bypasses
        // `@originjs/vite-plugin-federation`'s host-side package.json lookup
        // (index.mjs:993), which otherwise fails for packages whose exports
        // map omits `./package.json` (e.g. `@inertiajs/react`).
        shared: {
            react: {
                singleton: true,
                version:         '19.0.0',
                requiredVersion: '^19.0.0',
            },
            'react-dom': {
                singleton: true,
                version:         '19.0.0',
                requiredVersion: '^19.0.0',
            },
            '@inertiajs/react': {
                singleton: true,
                version:         '2.0.0',
                requiredVersion: '^2.0.0',
            },
            '@artisanpack-ui/react': {
                singleton: true,
                version:         '1.0.0',
                requiredVersion: '^1.0.0',
            },
        },
    });
}

export default defineConfig(({ isSsrBuild }) => ({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.tsx',
                'resources/js/keystone-form-island.tsx',
                'resources/js/keystone-privacy-island.tsx',
                // Bundles the artisanpack-ui/performance Web Vitals
                // collector so `@perfMonitor` can point at a manifest-
                // hashed URL instead of the vendor's public/-only
                // default `/vendor/artisanpack-performance/web-vitals.js`
                // (which we don't publish — the JS lives in
                // resources/js/vendor/ under source control).
                'resources/js/vendor/artisanpack-performance/web-vitals.js',
            ],
            ssr: 'resources/js/ssr.tsx',
            refresh: true,
        }),
        react(),
        tailwindcss(),
        wayfinder(),
        ...(isSsrBuild ? [] : [keystoneFederationPlugin()]),
    ],
    // The federation plugin emits ESNext output; align the host build so
    // dynamic-remote entries (which use top-level await) can be consumed.
    build: {
        target: 'esnext',
        rollupOptions: {
            // SSR does not register the federation plugin (see above), so
            // `virtual:__federation__` has no resolver. Externalize it in
            // the SSR bundle so Rollup leaves the dynamic import
            // untouched — the code path is guarded on the client (federated
            // panels short-circuit to null on the server, see
            // `AdminEditSlot`), so the import is never actually executed
            // during SSR.
            external: isSsrBuild ? ['virtual:__federation__'] : [],
        },
    },
    // Vite dev-server CORS: allow only the local development origins that
    // legitimately need to fetch assets cross-origin — Herd's `*.test`
    // sites and the standard localhost/127.0.0.1/::1 loopback triple that
    // Vite itself allows by default. `cors: true` reflects any request's
    // Origin header, which lets an arbitrary browser tab read the dev
    // server's source files while `npm run dev` is running.
    server: {
        cors: {
            origin: [
                /^https?:\/\/(?:.+\.)?test(?::\d+)?$/,
                /^https?:\/\/localhost(?::\d+)?$/,
                /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
                /^https?:\/\/\[::1\](?::\d+)?$/,
            ],
        },
    },
}));
