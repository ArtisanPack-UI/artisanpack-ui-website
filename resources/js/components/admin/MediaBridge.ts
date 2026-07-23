import { Component, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MediaModal } from '@/vendor/media-library';
import type { Media } from '@/vendor/media-library/types/media';

export interface MediaBridgeProps {
    open: boolean;
    onClose: () => void;
    onSelect: (media: Media[], context: string) => void;
    multiSelect?: boolean;
    maxSelections?: number;
    allowedTypes?: Array<'image' | 'video' | 'audio' | 'document'>;
    context?: string;
    title?: string;
}

/**
 * Cross-React-version bridge for the artisanpack-ui/media-library `MediaModal`.
 *
 * The bridge faces two structural issues:
 *
 * 1. **Cross-React boundary.** The prebuilt `/visual-editor/visual-editor.js`
 *    bundle inlines React 18, while Keystone runs on React 19. A hook-using
 *    component (the host's `MediaModal`) can't be rendered directly inside
 *    the editor's React 18 tree without throwing "Invalid hook call"
 *    (minified error #321). This class component owns no hooks, so React 18
 *    happily renders it as `null` while the modal lives in a separate
 *    React 19 portal root.
 *
 * 2. **Bridge lifecycle churn.** The editor's `MediaUploadBridge`
 *    conditionally renders the bridge only while `open === true`. Mounting,
 *    re-rendering Gutenberg's toolbar/dropdown, and other intra-gesture
 *    React state churn can briefly unmount + remount the bridge in the
 *    same tick — fast enough that the modal renders, the root tears down,
 *    and the user sees a frame-long flash before everything disappears.
 *    Tying the portal root to a single bridge instance is the wrong
 *    boundary.
 *
 * The fix is a module-level singleton portal root. The bridge instance
 * registers itself as the active session, but does NOT tear down the
 * portal on unmount. The dialog's `showModal()` call grabs focus, which
 * causes Gutenberg to deselect the active block and unmount the entire
 * `MediaUploadBridge` subtree — including our bridge instance. A
 * lifecycle-coupled portal would tear the modal down at that point and
 * the user would never see it. With the singleton, the modal continues
 * to live in `document.body` independently of any bridge instance.
 *
 * Tear-down happens only through deliberate user action: Cancel, X,
 * Escape, backdrop click, or completing a selection — all routed through
 * `handleClose` / `handleSelect`. The original bridge instance is usually
 * gone by then; we still try to forward `onSelect` / `onClose` to its
 * (now-detached) closures because the editor's selection callback
 * dispatches into the block store, which works regardless of whether the
 * React component that scheduled the dispatch is still mounted.
 */

let sharedContainer: HTMLDivElement | null = null;
let sharedRoot: Root | null = null;
let activeBridge: MediaBridge | null = null;

function ensureRoot(): void {
    if (sharedContainer && sharedRoot) return;
    sharedContainer = document.createElement('div');
    sharedContainer.setAttribute('data-ap-media-bridge-portal', '');
    document.body.appendChild(sharedContainer);
    sharedRoot = createRoot(sharedContainer);
}

function renderActive(): void {
    if (!sharedRoot) return;
    if (!activeBridge) {
        sharedRoot.render(null);
        return;
    }
    sharedRoot.render(activeBridge.modalElement());
}

export class MediaBridge extends Component<MediaBridgeProps> {
    override componentDidMount(): void {
        ensureRoot();
        // eslint-disable-next-line @typescript-eslint/no-this-alias -- the singleton needs a stable reference to the current bridge instance.
        activeBridge = this;
        renderActive();
    }

    override componentDidUpdate(): void {
        // Only the currently-active bridge drives the shared modal. Stale
        // updates from a bridge that has already been superseded are
        // ignored.
        if (activeBridge !== this) return;
        renderActive();
    }

    override componentWillUnmount(): void {
        // Intentionally leave the shared modal alone. The bridge nearly
        // always unmounts before the user gets a chance to interact with
        // the picker (the dialog's focus grab triggers Gutenberg's block
        // deselection, which unmounts MediaUploadBridge and the bridge
        // with it). Closing the modal here would defeat the entire
        // purpose of the singleton.
    }

    /**
     * Renders the MediaModal with proxied onClose/onSelect so the bridge
     * can drop the session even when its React parent has gone away.
     */
    modalElement() {
        return createElement(MediaModal, {
            ...this.props,
            onClose: this.handleClose,
            onSelect: this.handleSelect,
        });
    }

    private handleClose = (): void => {
        if (activeBridge !== this) return;
        activeBridge = null;
        renderActive();
        try {
            this.props.onClose();
        } catch {
            // Bridge parent may already be unmounted — the modal close is
            // what matters and that already happened.
        }
    };

    private handleSelect = (media: Media[], context: string): void => {
        if (activeBridge !== this) return;
        activeBridge = null;
        renderActive();
        try {
            this.props.onSelect(media, context);
        } catch {
            // Same as handleClose — selection is best-effort if the parent
            // has gone away.
        }
    };

    override render(): null {
        return null;
    }
}
