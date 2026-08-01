import { useCallback, useState } from 'react';

/**
 * Open state for the "Add New" modal on a content index screen.
 *
 * The admin menu's "Add …" links land on the index with `?new=1`, which
 * mounts the modal already open. That parameter has to be cleared once the
 * modal closes — otherwise it is still in the URL for every later
 * interaction with the page, so a reload, a Back from the record that was
 * just created, or a restore of the tab all reopen a dialog the user
 * already dismissed.
 *
 * `replaceState` rather than an Inertia visit: nothing on the server
 * depends on the parameter, and a visit would refetch the whole index just
 * to drop a query string.
 *
 * Shared by the Posts, Pages, and dynamic-content index screens, which had
 * three copies of the initializer and none of the cleanup.
 */
/**
 * @param autoOpenAllowed Whether `?new=1` may open the modal at all. The
 *   Pages and dynamic-content screens replace their "New …" trigger with a
 *   notice when the plan limit is reached or the records table is missing;
 *   honouring the parameter there would open a form that cannot be
 *   submitted and leave the dialog with no trigger to return focus to.
 */
export function useAddContentModal(autoOpenAllowed: boolean = true): {
    open: boolean;
    openModal: () => void;
    closeModal: () => void;
} {
    // Read in the initializer rather than syncing from an effect so the
    // very first render is already correct (and so the lint rule against
    // setState-in-effect stays satisfied).
    const [open, setOpen] = useState(
        () =>
            autoOpenAllowed &&
            typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search).get('new') === '1',
    );

    const openModal = useCallback(() => setOpen(true), []);

    const closeModal = useCallback(() => {
        setOpen(false);
        stripNewParam();
    }, []);

    return { open, openModal, closeModal };
}

function stripNewParam(): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);

    if (!url.searchParams.has('new')) return;

    url.searchParams.delete('new');

    // Keep the trailing `?` off a URL that has no parameters left.
    const search = url.searchParams.toString();
    const next = `${url.pathname}${search === '' ? '' : `?${search}`}${url.hash}`;

    window.history.replaceState(withInertiaUrl(window.history.state, next), '', next);
}

/**
 * Carry the cleaned URL into Inertia's own history entry as well.
 *
 * Inertia stores the current page under `history.state.page` and reads its
 * `url` back for things like `router.reload()`. `replaceState` alone only
 * moves the address bar, so Inertia would go on believing the page lives
 * at the `?new=1` URL and reuse it on the next partial visit.
 *
 * Left untouched when the shape isn't the plain one we expect — with
 * history encryption enabled `page` is an opaque blob, and a half-rewritten
 * entry would be worse than a stale one.
 */
function withInertiaUrl(state: unknown, url: string): unknown {
    if (state === null || typeof state !== 'object' || !('page' in state)) {
        return state;
    }

    const page = (state as { page?: unknown }).page;

    if (page === null || typeof page !== 'object' || typeof (page as { url?: unknown }).url !== 'string') {
        return state;
    }

    return { ...state, page: { ...page, url } };
}
