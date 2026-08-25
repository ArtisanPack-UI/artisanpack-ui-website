import { useEffect, useId, useRef, useState } from 'react';
import { router } from '@inertiajs/react';

export interface TaxonomyOption {
    value: number;
    label: string;
}

interface TaxonomyPickerProps {
    createLabel: string;
    emptyLabel: string;
    emptyHint: string;
    options: TaxonomyOption[];
    selected: number[];
    onToggle: (id: number) => void;
    createUrl: string;
    /**
     * Human label announced to screen readers for the group of chips
     * (e.g. "Categories"). Not rendered visually — the wrapping panel's
     * card title already carries that text.
     */
    ariaLabel: string;
}

export default function TaxonomyPicker({
    createLabel,
    emptyLabel,
    emptyHint,
    options,
    selected,
    onToggle,
    createUrl,
    ariaLabel,
}: TaxonomyPickerProps) {
    const [creating, setCreating] = useState(false);
    const [draftName, setDraftName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const errorId = useId();
    // Locally owned create-error state. The shared Inertia error bag
    // keys `create` failures under `name`, and rendering that shared
    // key in each picker would leak a Category-create failure into the
    // Tags panel (and vice-versa). Owning the message here scopes it
    // to the picker that actually submitted.
    const [createError, setCreateError] = useState<string | undefined>();
    // Polite announcement for the one outcome that is otherwise entirely
    // silent: a successful create. The region is mounted empty up front
    // because text arriving *into* a live region is what gets announced —
    // a region that appears already populated is routinely missed.
    const [announcement, setAnnouncement] = useState('');

    // All three ways out of the create UI (success, Cancel, Escape)
    // unmount the control holding focus, dropping it to `<body>`. The "+
    // Add new …" button is what replaces that UI, so it is where focus
    // belongs.
    const addButtonRef = useRef<HTMLButtonElement>(null);
    const wasCreatingRef = useRef(false);

    useEffect(() => {
        if (wasCreatingRef.current && !creating) {
            addButtonRef.current?.focus();
        }
        wasCreatingRef.current = creating;
    }, [creating]);

    // A create that lands but leaves the new term unselected is almost
    // never what the author meant — they typed the name into *this*
    // record's picker. The store action responds with `back()` rather than
    // the created row, so the new option has to be recognized in the
    // refreshed `options` prop.
    //
    // Matching on the submitted name and not merely "the id we hadn't seen
    // before": another tab, a collaborator, or a plugin can add a term
    // between our snapshot and the refresh, and picking the first unknown
    // id would then select somebody else's term on this record.
    const pendingCreateRef = useRef<{ name: string; knownIds: number[] } | null>(null);

    useEffect(() => {
        const pending = pendingCreateRef.current;
        if (pending === null) return;

        const created = options.find(
            (option) =>
                !pending.knownIds.includes(option.value) &&
                option.label.trim().toLowerCase() === pending.name.toLowerCase(),
        );
        if (created === undefined) return;

        pendingCreateRef.current = null;

        if (!selected.includes(created.value)) {
            onToggle(created.value);
        }

        setAnnouncement(`${created.label} added and selected.`);
    }, [options, selected, onToggle]);

    /** Leave the create UI without adopting whatever a late response brings back. */
    function cancelCreate() {
        pendingCreateRef.current = null;
        setCreating(false);
        setDraftName('');
        setCreateError(undefined);
    }

    // HTML doesn't allow nested <form>s, and this picker lives inside the
    // outer post-update form. Wrap the inline create UI in a <div> and
    // handle "submit on Enter" with an explicit keydown handler so the
    // Enter keypress never bubbles up to the parent form.
    function submitCreate() {
        const name = draftName.trim();
        if (name === '' || submitting) return;
        setSubmitting(true);
        setCreateError(undefined);
        pendingCreateRef.current = {
            name,
            knownIds: options.map((option) => option.value),
        };
        router.post(
            createUrl,
            { name },
            {
                // Stay on the post Edit screen with all in-progress changes
                // intact. The store action returns `back()` so the response
                // re-renders this same page with refreshed taxonomy props.
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setDraftName('');
                    setCreating(false);
                },
                onError: (errors) => {
                    // The create didn't land, so nothing new will appear in
                    // `options` — drop the snapshot or the next unrelated
                    // props refresh would be read as our result.
                    pendingCreateRef.current = null;
                    setCreateError(
                        typeof errors.name === 'string' ? errors.name : undefined,
                    );
                },
                onFinish: () => setSubmitting(false),
            },
        );
    }

    return (
        <div className="flex flex-col gap-2" role="group" aria-label={ariaLabel}>
            {/*
             * See the `announcement` state: mounted empty and always
             * present, so the text landing in it is the change AT reports.
             */}
            <span role="status" className="sr-only">
                {announcement}
            </span>
            {!creating && (
                <div className="flex items-center justify-end">
                    <button
                        ref={addButtonRef}
                        type="button"
                        onClick={() => setCreating(true)}
                        // `inline-flex items-center max-lg:min-h-11`: an
                        // 11px text link is ~16px tall, well under the 24px
                        // WCAG 2.5.8 floor with the chips right above it.
                        // The extra height is part of the tap target rather
                        // than dead space beside it.
                        className="inline-flex items-center rounded-md text-[11px] font-semibold text-primary max-lg:min-h-11 hover:underline focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                    >
                        + {createLabel}
                    </button>
                </div>
            )}
            {options.length === 0 ? (
                <div className="rounded-lg border border-dashed border-base-300 bg-base-200/30 px-5 py-6 text-center">
                    <div className="text-sm font-semibold text-base-content/75">{emptyLabel}</div>
                    <div className="mt-1 text-xs text-base-content/70">{emptyHint}</div>
                </div>
            ) : (
                <div className="flex flex-wrap gap-1.5">
                    {options.map((o) => {
                        const active = selected.includes(o.value);
                        return (
                            <button
                                key={o.value}
                                type="button"
                                aria-pressed={active}
                                onClick={() => onToggle(o.value)}
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                                    active
                                        ? 'border-primary bg-primary text-primary-content'
                                        : 'border-base-300/60 bg-base-100 text-base-content/75 hover:bg-base-200'
                                }`}
                            >
                                {o.label}
                            </button>
                        );
                    })}
                </div>
            )}
            {creating && (
                <div className="mt-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                        <input
                            type="text"
                            autoFocus
                            value={draftName}
                            aria-label={`New ${ariaLabel.toLowerCase()} name`}
                            aria-invalid={createError ? true : undefined}
                            aria-describedby={createError ? errorId : undefined}
                            onChange={(e) => {
                                setDraftName(e.target.value);
                                if (createError) setCreateError(undefined);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    // Stop the Enter keypress from bubbling
                                    // to the outer post-update form.
                                    e.preventDefault();
                                    e.stopPropagation();
                                    submitCreate();
                                } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelCreate();
                                }
                            }}
                            placeholder="Name"
                            className="h-8 flex-1 rounded-md border border-base-300/60 bg-base-100 px-2.5 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                        />
                        <button
                            type="button"
                            onClick={submitCreate}
                            disabled={submitting || draftName.trim() === ''}
                            className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Add
                        </button>
                        <button
                            type="button"
                            onClick={cancelCreate}
                            className="rounded-md border border-base-300/60 bg-base-100 px-2.5 py-1 text-xs font-semibold text-base-content/65 hover:bg-base-200"
                        >
                            Cancel
                        </button>
                    </div>
                    {createError && (
                        <div id={errorId} role="alert" className="text-xs text-error">
                            {createError}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
