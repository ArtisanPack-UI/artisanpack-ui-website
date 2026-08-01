/**
 * Move focus to the first field the server rejected.
 *
 * The editor already does the hard parts of a failed save — panels holding
 * an error are forced open, and each message renders with `role="alert"` —
 * but focus stayed on the submit button. So a keyboard or screen-reader
 * user was told something was wrong and then had to re-tab the entire form
 * to find it (WCAG 3.3.1 / 2.4.3).
 *
 * `requestAnimationFrame` waits for React to commit the re-render that
 * expands the errored panels and stamps `aria-invalid` on their controls —
 * querying before that runs finds nothing.
 *
 * `scrollIntoView` handles the case where the field is off-screen: a panel
 * that was collapsed or hidden until this render is very likely below the
 * fold.
 */
export function focusFirstInvalidField(root?: ParentNode): void {
    // Guard before touching `document` — a default parameter of
    // `document` is evaluated at call time and would throw on the server
    // before this check could run.
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const scope = root ?? document;

    window.requestAnimationFrame(() => {
        const target = scope.querySelector<HTMLElement>('[aria-invalid="true"]');

        if (!target) return;

        target.focus();
        target.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
}
