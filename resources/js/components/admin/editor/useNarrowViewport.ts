import { useSyncExternalStore } from 'react';

/**
 * The viewport below which the editor stops being a two-column, draggable
 * surface (issue #192).
 *
 * `1023.98px` rather than `1023px` so this flips on exactly the same pixel
 * as Tailwind's `lg:` variant — the grid template and the drag gating have
 * to agree, or there is a one-pixel band where the columns have collapsed
 * but cross-column dragging is still armed.
 */
export const EDITOR_NARROW_MEDIA_QUERY = '(max-width: 1023.98px)';

/**
 * One `MediaQueryList` for the whole app, created on first use rather than
 * at module scope so importing this file is safe on the server.
 *
 * `getSnapshot` runs on every render of every editor panel surface, and
 * `window.matchMedia` allocates a new live-updating object each call — one
 * shared instance keeps that to a single subscription.
 */
let mediaQuery: MediaQueryList | null = null;

/**
 * Returns `null` where the API isn't available.
 *
 * `getServerSnapshot` does not cover this: `useSyncExternalStore` only
 * calls it during server rendering and hydration, so on any subsequent
 * client render it is `getSnapshot` that runs. An environment with a
 * `window` but no `matchMedia` — jsdom without a stub, which is what
 * Vitest gives you by default — would therefore throw a TypeError and
 * take the whole editor tree down with it.
 */
function query(): MediaQueryList | null {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return null;
    }

    mediaQuery ??= window.matchMedia(EDITOR_NARROW_MEDIA_QUERY);

    return mediaQuery;
}

function subscribe(onStoreChange: () => void): () => void {
    const list = query();

    if (list === null) {
        return () => {};
    }

    list.addEventListener('change', onStoreChange);

    return () => list.removeEventListener('change', onStoreChange);
}

function getSnapshot(): boolean {
    return query()?.matches ?? false;
}

/**
 * Server render assumes the wide layout. It is the one the CSS also
 * produces before a client-side media query can be evaluated, so
 * hydration matches; a device that is actually narrow corrects itself on
 * the first `getSnapshot`.
 */
function getServerSnapshot(): boolean {
    return false;
}

/**
 * Whether the editor is currently below its two-column breakpoint.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: it reads the
 * query during render instead of after mount, so a narrow viewport never
 * paints one frame of the desktop layout (with a live drag sensor attached)
 * before flipping.
 */
export function useNarrowViewport(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
