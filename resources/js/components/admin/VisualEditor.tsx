import { useEffect, useRef } from 'react';
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
    // (`ap.visual-editor.resources` filter). Built-ins are `pages` and
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

declare global {
    interface Window {
        ApVisualEditorBoot?: (scope?: ParentNode) => Promise<unknown>;
        ApVisualEditor?: ApVisualEditorGlobal;
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
    // Prefer the artisanpack-specific helper (it documents intent at the
    // call site and stays type-safe against MediaModal's prop shape).
    // Older / customized visual-editor builds may only expose the generic
    // `registerMediaBridge` — fall back to that so the wiring still
    // succeeds rather than silently no-op'ing.
    if (api.registerArtisanpackMediaBridge) {
        api.registerArtisanpackMediaBridge({
            MediaModal: MediaBridge,
            uploadMedia,
        });
    } else if (api.registerMediaBridge) {
        api.registerMediaBridge({
            MediaBridge: MediaBridge,
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

// The visual-editor bundle's auto-scan only fires on initial page load. When
// Inertia client-navigates to an Edit page, the new marker element is added
// to the DOM but the bundle never re-scans, so the editor never mounts.
// `window.ApVisualEditorBoot` is exposed by the bundle for exactly this case.
// We poll briefly because the bundle's module evaluation is async — the
// global isn't defined the instant the script tag fires `load`.
async function bootVisualEditor(signal?: AbortSignal): Promise<void> {
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

    await window.ApVisualEditorBoot(document);
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
}: VisualEditorProps) {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // The bundle preloads its own CSS via Vite's helper (built with
        // base=/visual-editor/), so we only need to inject the script.
        const controller = new AbortController();
        ensureScript(SCRIPT_SRC)
            .then(() => {
                if (controller.signal.aborted) return;
                return bootVisualEditor(controller.signal);
            })
            .catch((err) => {
                if (controller.signal.aborted) return;
                console.error('Visual editor failed to load:', err);
            });
        return () => controller.abort();
    }, []);

    return (
        <div className="overflow-hidden rounded-xl border border-base-300/60 bg-base-100">
            <div
                ref={ref}
                data-ap-visual-editor
                data-resource={resource}
                data-id={String(id)}
                data-api-base={apiBase}
                {...(initialTitle ? { 'data-title': initialTitle } : {})}
                {...(initialSlug ? { 'data-slug': initialSlug } : {})}
                {...(initialStatus ? { 'data-status': initialStatus } : {})}
                {...(previewUrl ? { 'data-preview-url': previewUrl } : {})}
                {...(supports
                    ? { 'data-supports': JSON.stringify(supports) }
                    : {})}
                style={{ height: 'calc(100dvh - 6rem)' }}
                className="ap-visual-editor"
            />
        </div>
    );
}
