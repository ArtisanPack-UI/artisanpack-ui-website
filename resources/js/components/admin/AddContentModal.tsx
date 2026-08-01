import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';

export interface AddContentModalOption {
    value: number | string;
    label: string;
}

/**
 * Where focus goes on close when the modal was opened by something other
 * than a click — a `?new=1` menu link, which mounts it already open with
 * nothing focused yet.
 *
 * Every list screen that renders this modal gives its "New …" button this
 * id. The pages that deliberately withhold that button (Pages at its plan
 * limit, a content type with no backing table) also refuse `?new=1`, so
 * the lookup missing is not a case that arises in practice — and if it
 * ever does, focus simply stays where the browser puts it.
 */
const RETURN_FOCUS_FALLBACK = '#new-content-trigger';

/**
 * Id for the validation message, so the Title input can point at it via
 * `aria-describedby`. A fixed id is safe: only one modal is ever mounted
 * per screen.
 */
const ADD_CONTENT_ERROR_ID = 'add-content-modal-error';

export interface AddContentModalProps {
    open: boolean;
    onClose: () => void;
    /**
     * Singular, lowercase label for the content type — e.g. "post",
     * "page", "portfolio item". Used in the modal heading and button.
     */
    label: string;
    hierarchical: boolean;
    /**
     * Available parents for the picker. Only rendered when
     * `hierarchical` is true and the list is non-empty.
     */
    parentOptions: AddContentModalOption[];
    /**
     * Theme-provided templates. Only rendered when non-empty (Pages
     * with an active theme). Values are the template slugs the server
     * expects on the `template` field.
     */
    templates: AddContentModalOption[];
    /**
     * Fully-qualified POST endpoint for the quick-create submission.
     */
    quickCreateUrl: string;
}

/**
 * Add New content modal (#184). Collects a title (required, autofocus)
 * plus optional parent (hierarchical types) and template (Pages) before
 * POSTing to the type's quick-create endpoint. No DB row is written
 * until the user submits — replaces the auto-draft "Untitled" stub
 * flow.
 *
 * A true modal dialog (#193): focus moves to the title field on open, is
 * trapped inside the dialog while it is up, and returns to the trigger on
 * close; Escape and Cancel both close it, and the whole subtree is
 * `inert` while hidden.
 */
export function AddContentModal({
    open,
    onClose,
    label,
    hierarchical,
    parentOptions,
    templates,
    quickCreateUrl,
}: AddContentModalProps) {
    const [title, setTitle] = useState('');
    const [parentId, setParentId] = useState<string>('');
    const [template, setTemplate] = useState<string>('');
    const [parentQuery, setParentQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Which field the current message belongs to. The server can reject
    // `parent_id` or `template` just as easily as `title`, and pointing
    // the title input's `aria-invalid`/`aria-describedby` at *whatever*
    // came back would tell a screen-reader user the title is wrong when
    // it isn't. `null` means the message isn't about any one field.
    const [errorField, setErrorField] = useState<string | null>(null);
    // A ref tracks the previous `open` value so the reset logic only
    // fires on the closed→open transition — setState in the render body
    // would violate React's render purity.
    //
    // Seeded `false` rather than `open`: all three list screens can mount
    // with the modal already open (`?new=1` from an "Add …" menu link), and
    // seeding it `true` meant that path skipped the transition branch
    // entirely — so nothing captured a focus target and closing stranded
    // the user at the top of the document (#193 review). Running the branch
    // on a mount-open modal is otherwise free: the state it resets is
    // already at its initial value, so React bails out of the re-render.
    const wasOpenRef = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    // The control that had focus when the modal opened. Focus has to go
    // back to it on close, or a keyboard user who cancels resumes tabbing
    // from the top of the document instead of from the "Add New" button
    // they just pressed (#193).
    const returnFocusRef = useRef<HTMLElement | null>(null);
    // `onClose` is an inline arrow at every call site, so it is a new
    // function on every parent render. Read through a ref rather than
    // depending on it: the focus effect below must run on the open/closed
    // transition and nothing else, or a parent re-render mid-typing would
    // re-fire the autofocus and yank the caret back to the title.
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (open && !wasOpenRef.current) {
            setTitle('');
            setParentId('');
            setTemplate('');
            setParentQuery('');
            setError(null);
            setErrorField(null);
            setSaving(false);
            // Captured on the transition, not on every effect run: once the
            // dialog has focus, `document.activeElement` is one of its own
            // controls and re-reading it here would make "restore focus"
            // restore into the element that is about to go inert.
            //
            // On a mount-open modal nothing has been focused yet, so the
            // active element is `<body>` — useless to focus. Fall back to
            // the trigger that would have opened it, which is where the
            // user belongs once the dialog goes away.
            const active = document.activeElement;
            returnFocusRef.current =
                active instanceof HTMLElement && active !== document.body
                    ? active
                    : document.querySelector<HTMLElement>(RETURN_FOCUS_FALLBACK);
        }
        wasOpenRef.current = open;
    }, [open]);

    useEffect(() => {
        if (!open) {
            // Only restore once per open/close cycle, and only if the
            // trigger is still in the document — a modal that navigated
            // away has nothing to go back to.
            const target = returnFocusRef.current;
            returnFocusRef.current = null;
            if (target !== null && target.isConnected) {
                target.focus();
            }
            return;
        }

        function handleKey(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onCloseRef.current();
                return;
            }

            // Focus trap. `aria-modal` tells assistive tech the rest of the
            // page is inert, but it does nothing to the Tab order, so
            // without this the third Tab lands on the page behind the
            // overlay with no visible focus ring anywhere.
            if (event.key !== 'Tab') {
                return;
            }

            const focusable = Array.from(
                dialogRef.current?.querySelectorAll<HTMLElement>(
                    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ) ?? [],
            );
            if (focusable.length === 0) {
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;

            if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
                event.preventDefault();
                first.focus();
            } else if (
                event.shiftKey &&
                (active === first || !dialogRef.current?.contains(active))
            ) {
                event.preventDefault();
                last.focus();
            }
        }

        document.addEventListener('keydown', handleKey);
        const focusId = window.setTimeout(() => inputRef.current?.focus(), 0);

        return () => {
            document.removeEventListener('keydown', handleKey);
            window.clearTimeout(focusId);
        };
    }, [open]);

    const filteredParents = useMemo(() => {
        const q = parentQuery.trim().toLowerCase();
        if (!q) return parentOptions;
        // The currently-selected parent always survives the filter. Without
        // that, narrowing the search past your own selection left the
        // `<select>` with a value matching no option — so the browser
        // displayed "— No parent (top level) —" while `parentId` still held
        // the old id, and submitting created the record under a parent the
        // user could see had been cleared.
        return parentOptions.filter(
            (p) => p.label.toLowerCase().includes(q) || String(p.value) === parentId,
        );
    }, [parentOptions, parentQuery, parentId]);

    const showParent = hierarchical && parentOptions.length > 0;
    const showTemplate = templates.length > 0;

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;

        const trimmed = title.trim();
        if (trimmed === '') {
            setError(`Give this ${label} a title.`);
            setErrorField('title');
            // Focus the field the message is about. Without this the user
            // is left on the submit button being told, by a live region,
            // that something above them is wrong.
            inputRef.current?.focus();
            return;
        }

        setSaving(true);
        setError(null);
        setErrorField(null);

        const payload: Record<string, string | number> = { title: trimmed };
        if (showParent && parentId !== '') payload.parent_id = Number(parentId);
        if (showTemplate && template !== '') payload.template = template;

        router.post(quickCreateUrl, payload, {
            preserveScroll: false,
            onError: (errors) => {
                const firstKey = Object.keys(errors)[0];
                if (!firstKey) {
                    setError(`Could not create ${label}.`);
                    setErrorField(null);
                    return;
                }
                const err = errors[firstKey];
                setError(Array.isArray(err) ? String(err[0]) : String(err));
                setErrorField(firstKey);

                if (firstKey === 'title') {
                    inputRef.current?.focus();
                }
            },
            onFinish: () => setSaving(false),
        });
    }

    const headingId = 'add-content-modal-heading';

    return (
        <div
            className={`pointer-events-none fixed inset-0 z-50 ${open ? '' : 'invisible'}`}
            aria-hidden={!open}
            // `aria-hidden` alone leaves the closed modal's inputs and
            // buttons in the tab order — a hidden-from-AT element that
            // still takes focus is an axe "aria-hidden-focus" failure and,
            // more importantly, a keyboard user tabbing into a form they
            // cannot see. `inert` removes both (#193).
            inert={!open}
        >
            {/*
             * The scrim is a pointer-only dismissal: Escape and Cancel are
             * the keyboard and screen-reader paths, so it is deliberately
             * neither focusable nor exposed. A full-viewport "Close" button
             * in the tab order is a stop that announces nothing useful.
             */}
            <div
                aria-hidden
                className={`pointer-events-auto absolute inset-0 bg-black/40 transition-opacity ${
                    open ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={onClose}
            />

            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={headingId}
                className={`pointer-events-auto absolute left-1/2 top-1/2 flex w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-base-300/60 bg-base-100 shadow-2xl transition-opacity duration-150 ${
                    open ? 'opacity-100' : 'opacity-0'
                }`}
            >
                <header className="border-b border-base-300/60 px-5 py-4">
                    <h2
                        id={headingId}
                        className="font-display text-base font-semibold text-base-content"
                    >
                        New {label}
                    </h2>
                    <p className="mt-1 text-xs text-base-content/65">
                        Set the title now — you can edit everything else, including the
                        URL slug, once the editor opens.
                    </p>
                </header>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
                    <label className="flex flex-col gap-1.5 text-sm">
                        <span className="font-medium text-base-content">Title</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder={`e.g. My first ${label}`}
                            maxLength={255}
                            // No `required`: the custom check in
                            // `handleSubmit` owns this field's validation,
                            // and a native constraint on top of it means
                            // two competing messages — the browser bubble
                            // preempts the `role="alert"` text, which is
                            // the one wired to the input below.
                            aria-invalid={errorField === 'title' ? true : undefined}
                            aria-describedby={
                                errorField === 'title' ? ADD_CONTENT_ERROR_ID : undefined
                            }
                            className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm text-base-content placeholder:text-base-content/60 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        />
                    </label>

                    {showParent && (
                        <div className="flex flex-col gap-1.5 text-sm">
                            <label
                                htmlFor="add-content-modal-parent"
                                className="font-medium text-base-content"
                            >
                                Parent
                            </label>
                            {parentOptions.length > 8 && (
                                <input
                                    type="search"
                                    value={parentQuery}
                                    onChange={(event) => setParentQuery(event.target.value)}
                                    // The visible "Parent" label belongs to
                                    // the `<select>` below, so this control
                                    // had nothing but a placeholder for a
                                    // name — and a placeholder disappears
                                    // the moment the user types.
                                    aria-label="Search parents"
                                    placeholder="Search parents…"
                                    className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-xs text-base-content placeholder:text-base-content/60 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                />
                            )}
                            <select
                                id="add-content-modal-parent"
                                value={parentId}
                                onChange={(event) => setParentId(event.target.value)}
                                className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm text-base-content focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                                <option value="">— No parent (top level) —</option>
                                {filteredParents.map((opt) => (
                                    <option key={String(opt.value)} value={String(opt.value)}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {showTemplate && (
                        <label className="flex flex-col gap-1.5 text-sm">
                            <span className="font-medium text-base-content">Template</span>
                            <select
                                value={template}
                                onChange={(event) => setTemplate(event.target.value)}
                                className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm text-base-content focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                                <option value="">Default template</option>
                                {templates.map((opt) => (
                                    <option key={String(opt.value)} value={String(opt.value)}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {error && (
                        <p id={ADD_CONTENT_ERROR_ID} role="alert" className="text-xs text-error">
                            {error}
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md px-3 py-1.5 text-xs font-semibold text-base-content/75 hover:bg-base-200/60 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-content hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
                        >
                            {saving ? 'Creating…' : `Create ${label}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
