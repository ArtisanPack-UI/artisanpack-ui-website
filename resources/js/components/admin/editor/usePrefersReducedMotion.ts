import { useSyncExternalStore } from 'react';

/**
 * Whether the user has asked the operating system to reduce motion.
 *
 * The editor's stylesheet already zeroes transitions under a
 * `prefers-reduced-motion: reduce` media block, but dnd-kit hands its
 * transition back as an *inline* style — and inline styles beat any
 * stylesheet rule. So panels still slid and sprang for exactly the users
 * who asked them not to (WCAG 2.3.3). Reading the preference in JS is the
 * only way to suppress a value that is itself applied from JS.
 *
 * Shape deliberately mirrors {@link useNarrowViewport}: one shared
 * `MediaQueryList` created on first use (so importing this module is safe
 * on the server), and `useSyncExternalStore` so the value is read during
 * render rather than after mount — a drag that begins on the first frame
 * would otherwise animate once before the preference took effect.
 */
export const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

let mediaQuery: MediaQueryList | null = null;

/** See {@link useNarrowViewport}'s `query()` for why this can be null. */
function query(): MediaQueryList | null {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return null;
    }

    mediaQuery ??= window.matchMedia(REDUCED_MOTION_MEDIA_QUERY);

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
 * Server render assumes motion is fine, matching what the CSS produces
 * before a client-side media query can be evaluated. A user who has the
 * preference set corrects on the first `getSnapshot`, before any drag can
 * start.
 */
function getServerSnapshot(): boolean {
    return false;
}

export function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
