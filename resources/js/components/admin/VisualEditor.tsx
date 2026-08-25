import { useEffect, useRef } from 'react';
import { applyFilters, doAction } from '@artisanpack-ui/hooks-js';
import { uploadMedia } from '@/vendor/media-library';
import { MediaBridge } from '@/components/admin/MediaBridge';

interface DocumentSupports {
    title?: boolean;
    document?: boolean;
    excerpt?: boolean;
    featuredImage?: boolean;
    comments?: boolean;
}

interface VisualEditorProps {
    // Any slug registered in the framework's visual-editor resource map
    // (`ap.visualEditor.resources` filter). Built-ins are `pages` and
    // `posts`; Keystone registers admin-created content types here
    // via {@see App\Providers\AppServiceProvider} for #111.
    resource: string;
    id: number | string;
    apiBase?: string;
    initialTitle?: string;
    initialSlug?: string;
    initialStatus?: string;
    previewUrl?: string | null;
    supports?: DocumentSupports;
    /**
     * Fired once the editor's boot attempt has settled — whether it
     * mounted successfully, gave up, or failed outright. Consumers gate
     * the primary Save on this so a click that lands during the mount
     * window is never silently dropped (issue #237). It deliberately
     * fires on failure too: a bundle that never boots must not leave the
     * form's only Save button permanently inert.
     */
    onReady?: () => void;
}

const SCRIPT_SRC = '/visual-editor/visual-editor.js';

interface ApVisualEditorGlobal {
    boot: (scope?: ParentNode) => Promise<unknown>;
    registerArtisanpackMediaBridge: (options: {
        MediaModal: unknown;
        uploadMedia: unknown;
    }) => void;
    registerMediaBridge: (options: {
        MediaBridge: unknown;
        uploadMedia: unknown;
    }) => void;
}

/**
 * Snapshot of the visual-editor API-surface filters run at boot time.
 * Written to `window.ApKeystoneVisualEditorHooks` so the vendor bundle
 * (or a future admin-side consumer) can read a consistent, plugin-
 * enriched set of blocks / patterns / toolbar items / inspector tabs
 * / keybindings without each plugin needing to reach into the bundle
 * itself. Each entry starts as an empty list so subscribers can
 * `addFilter(...)` today and be visible when consumption lands.
 */
interface VisualEditorHookSurface {
    registerBlock: unknown[];
    registerPattern: unknown[];
    toolbarItems: unknown[];
    inspectorTabs: unknown[];
    keybindings: unknown[];
}

declare global {
    interface Window {
        ApVisualEditorBoot?: (scope?: ParentNode) => Promise<unknown>;
        ApVisualEditor?: ApVisualEditorGlobal;
        ApKeystoneVisualEditorHooks?: VisualEditorHookSurface;
    }
}

// Tracks whether the artisanpack-ui/media-library bridge has been registered
// against the loaded visual-editor bundle. The bridge state lives in the
// bundle's module scope, so a single registration covers every subsequent
// mount within the same page session. Re-registering is idempotent in the
// bundle, but the flag avoids redundant work on every Inertia navigation.
let mediaBridgeRegistered = false;

function registerMediaBridgeOnce(): void {
    if (mediaBridgeRegistered) return;
    if (typeof window === 'undefined') return;

    const api = window.ApVisualEditor;
    if (!api) return;

    // Pass `MediaBridge` (a class wrapper that mounts MediaModal in its own
    // React 19 root) rather than MediaModal directly, since the editor
    // bundle ships its own React 18 instance and a hook-using component
    // can't cross that boundary. See MediaBridge.ts for the full reasoning.
    //
    // Route the bridge class through `.visualEditor.mediaBridge` first so
    // a plugin can swap in a wrapping class (analytics, permission-
    // gating, or a completely custom picker that adheres to the same
    // `MediaBridgeProps` shape). Args: `(ComponentClass, { uploadMedia })`.
    // Returning `null` leaves the vendor bundle without a bridge —
    // media blocks then render their built-in fallback picker.
    const filteredBridge = applyFilters<typeof MediaBridge | null | undefined>(
        'keystone.admin.visualEditor.mediaBridge',
        MediaBridge,
        { uploadMedia },
    );
    // `== null` catches both an explicit `null` (documented "disable")
    // and an accidental `undefined` from a subscriber that forgot to
    // return — either way the vendor bundle would blow up trying to
    // instantiate a nullish class.
    if (filteredBridge == null) {
        return;
    }

    // Prefer the artisanpack-specific helper (it documents intent at the
    // call site and stays type-safe against MediaModal's prop shape).
    // Older / customized visual-editor builds may only expose the generic
    // `registerMediaBridge` — fall back to that so the wiring still
    // succeeds rather than silently no-op'ing.
    if (api.registerArtisanpackMediaBridge) {
        api.registerArtisanpackMediaBridge({
            MediaModal: filteredBridge,
            uploadMedia,
        });
    } else if (api.registerMediaBridge) {
        api.registerMediaBridge({
            MediaBridge: filteredBridge,
            uploadMedia,
        });
    } else {
        return;
    }
    mediaBridgeRegistered = true;
}

function ensureScript(src: string): Promise<void> {
    if (typeof document === 'undefined') return Promise.resolve();
    const existing = document.querySelector<HTMLScriptElement>(
        `script[data-ve-asset="${src}"]`,
    );
    if (existing) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = src;
        script.dataset.veAsset = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
    });
}

/**
 * Fire the passthrough API-surface filters and stash the results on the
 * window so the vendor bundle (or a future admin consumer) can read a
 * consistent, plugin-enriched snapshot. Runs immediately before the
 * boot call so subscribers registered at plugin load time are visible.
 * Each filter starts with an empty list and follows the standard
 * `(list, {resource?, id?}) => list` contract; consumers are expected
 * to treat the return value as read-only.
 */
function collectVisualEditorSurface(context: { resource?: string; id?: number | string }): void {
    if (typeof window === 'undefined') return;

    window.ApKeystoneVisualEditorHooks = {
        registerBlock: applyFilters<unknown[]>(
            'keystone.admin.visualEditor.registerBlock',
            [],
            context,
        ),
        registerPattern: applyFilters<unknown[]>(
            'keystone.admin.visualEditor.registerPattern',
            [],
            context,
        ),
        toolbarItems: applyFilters<unknown[]>(
            'keystone.admin.visualEditor.toolbar.items',
            [],
            context,
        ),
        inspectorTabs: applyFilters<unknown[]>(
            'keystone.admin.visualEditor.inspector.tabs',
            [],
            context,
        ),
        keybindings: applyFilters<unknown[]>(
            'keystone.admin.visualEditor.keybindings',
            [],
            context,
        ),
    };
}

// The visual-editor bundle's auto-scan only fires on initial page load. When
// Inertia client-navigates to an Edit page, the new marker element is added
// to the DOM but the bundle never re-scans, so the editor never mounts.
// `window.ApVisualEditorBoot` is exposed by the bundle for exactly this case.
// We poll briefly because the bundle's module evaluation is async — the
// global isn't defined the instant the script tag fires `load`.
async function bootVisualEditor(
    signal?: AbortSignal,
    context: { resource?: string; id?: number | string } = {},
): Promise<void> {
    if (typeof window === 'undefined') return;

    for (let i = 0; i < 50 && typeof window.ApVisualEditorBoot !== 'function'; i++) {
        if (signal?.aborted) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
    }

    if (signal?.aborted) return;

    if (typeof window.ApVisualEditorBoot !== 'function') {
        console.error(
            'Visual editor failed to boot: window.ApVisualEditorBoot was never defined. ' +
                'The /visual-editor bundle may have failed to evaluate.',
        );
        return;
    }

    // Register the artisanpack-ui/media-library bridge BEFORE booting so the
    // editor's core image / gallery / video blocks find a picker the moment
    // they mount. Registering after boot also works (the bundle resolves the
    // bridge lazily), but doing it here keeps the first paint clean.
    registerMediaBridgeOnce();

    // Snapshot the passthrough API-surface filters so subscriber-provided
    // blocks / patterns / toolbar items / etc. are visible to the bundle
    // at the moment it evaluates. Cheap enough to redo on every boot —
    // Inertia navigations remount the editor and a plugin may have
    // registered its subscribers in between.
    collectVisualEditorSurface(context);

    // Action fences bracket the boot call so plugins can register block
    // renderers or attach editor-lifecycle listeners around the actual
    // ApVisualEditorBoot invocation. Errors thrown from a plugin handler
    // are isolated from the boot call itself — subscribers should catch
    // their own failures.
    doAction('keystone.admin.visualEditor.beforeBoot', document);
    try {
        await window.ApVisualEditorBoot(document);
    } finally {
        // `.booted` fires in the `finally` block regardless of success —
        // subscribers get a stable "the boot attempt is over" signal
        // without needing to observe promise rejections themselves.
        doAction('keystone.admin.visualEditor.booted', document);
    }
}

/**
 * Mounts the artisanpack-ui/visual-editor V1 React editor inside Keystone.
 *
 * The editor ships as a self-bootstrapping ES module that scans the DOM for
 * `[data-ap-visual-editor]` markers and hydrates each one into its own React
 * root. We drop the marker div here and append the editor's prebuilt JS/CSS
 * as ordinary `<link>`/`<script type="module">` tags. The isolated React
 * root keeps the editor's React 18 copy from colliding with Keystone's
 * React 19 tree.
 *
 * Assets live in `public/visual-editor/` (symlinked to the vendor dist).
 */
export default function VisualEditor({
    resource,
    id,
    apiBase = '/visual-editor/api',
    initialTitle,
    initialSlug,
    initialStatus,
    previewUrl,
    supports,
    onReady,
}: VisualEditorProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    // Held in a ref so a fresh `onReady` closure on every parent render
    // doesn't retrigger the boot effect (its deps stay `[resource, id]`).
    // The boot effect only reads it asynchronously, long after this sync
    // effect has published the latest closure.
    const onReadyRef = useRef(onReady);
    useEffect(() => {
        onReadyRef.current = onReady;
    });

    useEffect(() => {
        // Route the bundle URL through `.visualEditor.scriptSrc` so a
        // plugin (or a CDN-adjacent deployment) can serve the editor JS
        // from a different origin without forking VisualEditor.tsx.
        // Args: `(string, { resource, id })`. Return the (possibly
        // rewritten) URL. Falsy OR non-string → `SCRIPT_SRC` fallback:
        // a subscriber returning a non-string would otherwise reach
        // `ensureScript()` and produce a bogus `script.src` plus a
        // query-string injection surface via the `data-ve-asset`
        // selector that reads it back.
        const filteredScriptSrc = applyFilters<string>(
            'keystone.admin.visualEditor.scriptSrc',
            SCRIPT_SRC,
            { resource, id },
        );
        const scriptSrc = 'string' === typeof filteredScriptSrc && filteredScriptSrc
            ? filteredScriptSrc
            : SCRIPT_SRC;

        // The bundle preloads its own CSS via Vite's helper (built with
        // base=/visual-editor/), so we only need to inject the script.
        const controller = new AbortController();
        ensureScript(scriptSrc)
            .then(() => {
                if (controller.signal.aborted) return;
                return bootVisualEditor(controller.signal, { resource, id });
            })
            .catch((err) => {
                if (controller.signal.aborted) return;
                console.error('Visual editor failed to load:', err);
            })
            .finally(() => {
                // The boot attempt is over (mounted, gave up, or errored).
                // Skip only when this mount was torn down mid-boot — the
                // parent is gone and there is no Save to unlock.
                if (controller.signal.aborted) return;
                onReadyRef.current?.();
            });
        return () => controller.abort();
    }, [resource, id]);

    // Assemble the mount container's `data-*` attribute set, then route
    // it through `.visualEditor.container.attrs` so a plugin can inject
    // its own data-* props (feature flags, telemetry tags) that the
    // vendor bundle reads at scan time. Args: `(Record<string, string>,
    // { resource, id })`. Return the (possibly rewritten) map — non-
    // string values are dropped so the resulting DOM stays predictable.
    const baseAttrs: Record<string, string> = {
        'data-resource': resource,
        'data-id':       String(id),
        'data-api-base': apiBase,
    };
    if (initialTitle) {
        baseAttrs['data-title'] = initialTitle;
    }
    if (initialSlug) {
        baseAttrs['data-slug'] = initialSlug;
    }
    if (initialStatus) {
        baseAttrs['data-status'] = initialStatus;
    }
    if (previewUrl) {
        baseAttrs['data-preview-url'] = previewUrl;
    }
    if (supports) {
        baseAttrs['data-supports'] = JSON.stringify(supports);
    }

    // Fall back to `baseAttrs` if a subscriber returned `null` /
    // `undefined` — mirroring `scriptSrc`'s falsy-fallback pattern
    // above rather than crashing the `Object.entries()` below and
    // taking the whole editor mount down.
    const filteredAttrs = applyFilters<Record<string, string> | null | undefined>(
        'keystone.admin.visualEditor.container.attrs',
        baseAttrs,
        { resource, id },
    ) ?? baseAttrs;

    const safeAttrs: Record<string, string> = {};
    for (const [key, value] of Object.entries(filteredAttrs)) {
        if (typeof value === 'string' && key.startsWith('data-')) {
            safeAttrs[key] = value;
        }
    }

    return (
        <div className="overflow-hidden rounded-xl border border-base-300/60 bg-base-100">
            <div
                ref={ref}
                data-ap-visual-editor
                {...safeAttrs}
                style={{ height: 'calc(100dvh - 6rem)' }}
                className="ap-visual-editor"
            />
        </div>
    );
}
