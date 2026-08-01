import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
    EditorPanelChromeProvider,
    useEditorPanelChrome,
} from '@/components/admin/editor/panelChrome';

export interface StatusOption {
    value: 'draft' | 'published' | 'scheduled' | 'private';
    label: string;
}

export type ActualStatus = StatusOption['value'];

interface PublishPanelProps {
    /** User-intended status (from the form). */
    status: StatusOption['value'];
    /** Persisted status the record had when Edit first mounted. */
    initialStatus: StatusOption['value'];
    /** Server-derived read-only chip: what the record actually IS right now. */
    actualStatus: ActualStatus;
    statuses: StatusOption[];
    /** Whether the record has ever been published (drives Publish/Update copy). */
    hasEverBeenPublished: boolean;

    author: string | null;
    showAuthor: boolean;

    /** ISO 8601 string from the form, or null when "Immediately". */
    publishedAt: string | null;
    /** Site timezone label surfaced under the date picker. */
    siteTimezone: string;

    /** Dirty flag from the parent form; drives the "unsaved changes" pill note. */
    isDirty: boolean;

    /** When present, enables the Preview button and opens this URL in a new tab. */
    previewUrl?: string | null;

    statusError?: string;
    publishedAtError?: string;

    onStatusChange: (value: StatusOption['value']) => void;
    onPublishedAtChange: (value: string | null) => void;
    /** Save Draft link — parent submits with status forced to draft. */
    onSaveDraft: () => void;
    /** Move to Trash — parent runs its delete handler. */
    onDelete: () => void;
}

/**
 * WordPress-classic Publish box (issue #187). The parent form's
 * `<button type="submit">` moves in here, so the panel owns the
 * primary Save + the Save Draft/Delete controls that used to live in
 * the page header. Scheduling is inline: pick a future date and the
 * primary button copy flips to `Schedule` (Ghost pattern); clearing
 * reverts. Status is persisted as-submitted — the server (BlogManager
 * / PageManager) is the authority on `published_at` stamping.
 *
 * The card is intentionally NOT collapsible: it owns the only Save
 * button on the page, so a collapsed body (marked `inert` by
 * `CollapsibleCard`) would make submit unreachable.
 */
export default function PublishPanel({
    status,
    initialStatus,
    actualStatus,
    statuses,
    hasEverBeenPublished,
    author,
    showAuthor,
    publishedAt,
    siteTimezone,
    isDirty,
    previewUrl,
    statusError,
    publishedAtError,
    onStatusChange,
    onPublishedAtChange,
    onSaveDraft,
    onDelete,
}: PublishPanelProps) {
    // "Publish on" starts collapsed and shows "Immediately" for records
    // with no `published_at`; the [Edit] toggle reveals the datetime
    // input inline. Records that already have a date open expanded so
    // authors don't have to click through to see it.
    const [dateEditing, setDateEditing] = useState<boolean>(publishedAt !== null);

    // The Ghost-pattern auto-flip changes the Status select without the
    // user touching it — a silent context change (WCAG 4.1.3). Announced
    // through the polite region at the bottom of the panel; empty on
    // mount so the announcement is the text arriving.
    const [announcement, setAnnouncement] = useState('');

    /**
     * Put text into the live region, clearing first.
     *
     * Assistive tech announces a live region when its *content changes*.
     * Draft → Scheduled → Draft → Scheduled is a real sequence here (set a
     * future date, clear it, set another), and writing the identical
     * string a second time is not a change — so the second flip would be
     * as silent as the bug this region exists to fix. Blanking on one
     * frame and writing on the next guarantees a transition either way.
     */
    const announce = useCallback((message: string) => {
        setAnnouncement('');
        requestAnimationFrame(() => setAnnouncement(message));
    }, []);

    const chrome = useEditorPanelChrome();

    const statusId = useId();
    const dateId = useId();
    const dateHintId = useId();
    const statusErrorId = useId();
    const dateErrorId = useId();
    const previewHintId = useId();

    // Toggling "Publish on" swaps the control the user was standing on for
    // a different one, so focus has to follow the swap or it drops to the
    // document (#193). `null` on mount means a record that opens expanded
    // — because it already has a date — doesn't steal focus from the title.
    const dateInputRef = useRef<HTMLInputElement>(null);
    const dateToggleRef = useRef<HTMLButtonElement>(null);
    const dateFocusRef = useRef<'input' | 'toggle' | null>(null);

    useEffect(() => {
        if (dateFocusRef.current === 'input') {
            dateInputRef.current?.focus();
        } else if (dateFocusRef.current === 'toggle') {
            dateToggleRef.current?.focus();
        }
        dateFocusRef.current = null;
    }, [dateEditing]);

    const isFuture = useCallback((iso: string | null): boolean => {
        if (null === iso) return false;
        return new Date(iso).getTime() > new Date().getTime();
    }, []);

    // Ghost-pattern auto-flip: setting a future date on a draft flips
    // the intended status to Scheduled. We deliberately do NOT touch a
    // Published record's status here — changing the publish date on a
    // live post shouldn't unpublish it.
    //
    // Note what this does NOT do: revert to Draft on an empty value.
    // Browsers fire `onChange` with `value === ''` partway through
    // retyping a datetime-local, so treating "empty" as "the user
    // cleared the date" silently knocked a Scheduled record back to
    // Draft mid-edit — and if they finished on a non-future time nothing
    // flipped it back, so the record stayed a draft while the author
    // believed they had rescheduled. Clearing is an explicit act now;
    // see {@link handleClear}.
    const handlePublishedAtChange = useCallback(
        (next: string | null) => {
            onPublishedAtChange(next);
            if (null !== next && isFuture(next) && 'draft' === status) {
                onStatusChange('scheduled');
                announce('Status changed to Scheduled.');
            }
        },
        [announce, isFuture, onPublishedAtChange, onStatusChange, status],
    );

    /** The Clear button — the one path that means "no publish date". */
    const handleClear = useCallback(() => {
        onPublishedAtChange(null);
        if ('scheduled' === status && !hasEverBeenPublished) {
            onStatusChange('draft');
            announce('Status changed to Draft.');
        }
    }, [announce, hasEverBeenPublished, onPublishedAtChange, onStatusChange, status]);

    const primaryLabel = useMemo(() => {
        if ('scheduled' === status) {
            return 'scheduled' === initialStatus ? 'Update schedule' : 'Schedule';
        }
        if ('published' === status || hasEverBeenPublished) {
            return 'Update';
        }
        return 'Publish';
    }, [hasEverBeenPublished, initialStatus, status]);

    const actualStatusLabel = useMemo(() => {
        const base = actualStatusText(actualStatus, statuses);
        // The "(unsaved changes)" suffix only makes sense for records
        // already live — a dirty draft or a dirty scheduled row will
        // switch state on save anyway.
        if ('published' === actualStatus && isDirty) {
            return `${base} (unsaved changes)`;
        }
        return base;
    }, [actualStatus, isDirty, statuses]);

    const previewEnabled = null !== previewUrl && undefined !== previewUrl;

    return (
        <section
            aria-labelledby={`${statusId}-heading`}
            className="rounded-xl border border-base-300/60 bg-base-100"
        >
            {/*
             * Reorder chrome comes from context (issue #190) so this panel
             * drags and moves columns like the others. `chrome.collapsible`
             * is false for Publish, so the menu offers moves but no
             * Collapse and no Hide — see the class comment above.
             */}
            <header
                className="flex items-center justify-between gap-3 py-4 pr-3 pl-5"
                onKeyDown={chrome?.onHeaderKeyDown}
            >
                <h2
                    id={`${statusId}-heading`}
                    className="font-display text-sm font-semibold tracking-wide uppercase text-base-content/85"
                >
                    Publish
                </h2>
                {chrome?.controls}
            </header>
            {/*
             * Chrome is consumed here, matching `CollapsibleCard`: a
             * `CollapsibleCard` nested in this body later would otherwise
             * inherit Publish's chrome and grow a second drag handle that
             * reorders its parent.
             */}
            <EditorPanelChromeProvider value={null}>
                <div className="flex flex-col gap-4 border-t border-base-300/60 px-5 py-5">
                    {/*
                     * Every control in this panel carries `max-lg:min-h-11`
                     * (plus `inline-flex items-center`, so the extra height
                     * is part of the tap target rather than dead space
                     * beside it). Below the editor's narrow breakpoint the
                     * pointer is a finger, and WCAG 2.5.5 wants 44×44 —
                     * see issue #192.
                     */}
                    <div className="flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={onSaveDraft}
                            className="inline-flex items-center rounded-md text-xs font-semibold text-base-content/70 underline-offset-2 max-lg:min-h-11 hover:text-base-content hover:underline focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                        >
                            Save Draft
                        </button>
                        {previewEnabled ? (
                            <a
                                href={previewUrl ?? '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-base-300/60 bg-base-100 px-3 py-1.5 text-xs font-semibold text-base-content/75 max-lg:min-h-11 hover:bg-base-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                            >
                                Preview
                            </a>
                        ) : (
                            <>
                                {/*
                                 * `aria-disabled` + a no-op click rather
                                 * than the native `disabled` attribute: a
                                 * natively-disabled button is unfocusable
                                 * and out of the accessibility tree, so
                                 * the reason it's unavailable — which
                                 * lived only in a `title` tooltip, itself
                                 * unreachable by keyboard — could not be
                                 * discovered at all. Now the control is
                                 * reachable, announced as disabled, and
                                 * described by real text.
                                 */}
                                <button
                                    type="button"
                                    aria-disabled="true"
                                    aria-describedby={previewHintId}
                                    onClick={(e) => e.preventDefault()}
                                    className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-base-300/60 bg-base-100 px-3 py-1.5 text-xs font-semibold text-base-content/40 max-lg:min-h-11"
                                >
                                    Preview
                                </button>
                                <span id={previewHintId} className="sr-only">
                                    Preview isn&apos;t available for this record yet.
                                </span>
                            </>
                        )}
                    </div>

                    {/*
                     * Status + actual-status pill.
                     * Rendered as a compound row rather than a `<Field>` —
                     * Field wraps its content in a `<label>`, which
                     * forwards clicks to its implicitly-associated
                     * control. Nesting the pill's own button-like styling
                     * inside a label would misroute keyboard/pointer
                     * events. `htmlFor`/`aria-describedby` give screen
                     * readers the same association Field would.
                     */}
                    <div className="flex flex-col gap-1.5 text-sm">
                        <label htmlFor={statusId} className="font-semibold text-base-content/85">
                            Status
                        </label>
                        <div className="flex items-center gap-2">
                            <select
                                id={statusId}
                                value={status}
                                aria-invalid={statusError ? true : undefined}
                                aria-describedby={statusError ? statusErrorId : undefined}
                                onChange={(e) =>
                                    onStatusChange(e.target.value as StatusOption['value'])
                                }
                                className="h-9 flex-1 rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                                {statuses.map((s) => (
                                    <option key={s.value} value={s.value}>
                                        {s.label}
                                    </option>
                                ))}
                            </select>
                            {/*
                             * The pill sits immediately after the Status
                             * select, so unlabelled it reads as a second,
                             * mysterious value for the same control. The
                             * `sr-only` prefix names what it actually is.
                             */}
                            <span
                                data-actual-status={actualStatus}
                                className={actualStatusPillClass(actualStatus)}
                            >
                                <span className="sr-only">Current status: </span>
                                {actualStatusLabel}
                            </span>
                        </div>
                        {statusError && (
                            <span id={statusErrorId} role="alert" className="text-xs text-error">
                                {statusError}
                            </span>
                        )}
                    </div>

                    {/*
                     * Publish on.
                     * Same reason as above for being a compound row and
                     * not a `<Field>`: the Clear / Edit buttons live
                     * inside this control and mustn't be nested in a
                     * label. `htmlFor` still points at the datetime input.
                     */}
                    <div className="flex flex-col gap-1.5 text-sm">
                        {/*
                         * The label is a `<label htmlFor>` only while the
                         * datetime input exists. Collapsed, the value is a
                         * read-only `<span>` — and a `<label>` pointing at a
                         * non-labelable element is both invalid HTML and an
                         * axe "form label" failure, so it becomes plain text
                         * with the [Edit] button naming itself instead.
                         */}
                        {dateEditing ? (
                            <>
                                <label
                                    htmlFor={dateId}
                                    className="font-semibold text-base-content/85"
                                >
                                    Publish on
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={dateInputRef}
                                        id={dateId}
                                        type="datetime-local"
                                        value={toDateTimeLocal(publishedAt)}
                                        /*
                                         * Deliberately no `min`. A `min` of
                                         * "now" fails native constraint
                                         * validation for every already-
                                         * published record (whose date is
                                         * necessarily in the past), and the
                                         * form has no `noValidate`, so the
                                         * primary submit button would be
                                         * blocked by a browser bubble
                                         * instead of saving. Backdating is
                                         * legitimate anyway; the server is
                                         * the authority and only requires
                                         * `after:now` when the user is
                                         * actually scheduling
                                         * (HandlesPublication).
                                         */
                                        aria-invalid={publishedAtError ? true : undefined}
                                        aria-describedby={
                                            publishedAtError ? dateErrorId : dateHintId
                                        }
                                        onChange={(e) =>
                                            handlePublishedAtChange(
                                                fromDateTimeLocal(e.target.value),
                                            )
                                        }
                                        className="h-9 flex-1 rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            dateFocusRef.current = 'toggle';
                                            handleClear();
                                            setDateEditing(false);
                                        }}
                                        className="inline-flex items-center rounded-md text-xs font-semibold text-base-content/70 max-lg:min-h-11 hover:text-base-content focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                                    >
                                        Clear
                                    </button>
                                </div>
                                {!publishedAtError && (
                                    <span id={dateHintId} className="text-xs text-base-content/70">
                                        Times shown in your local timezone. Site timezone:{' '}
                                        {siteTimezone}.
                                    </span>
                                )}
                            </>
                        ) : (
                            <>
                                <span className="font-semibold text-base-content/85">
                                    Publish on
                                </span>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm text-base-content/70">
                                        {publishedAt ? formatDisplay(publishedAt) : 'Immediately'}
                                    </span>
                                    <button
                                        ref={dateToggleRef}
                                        type="button"
                                        // Named in full: a bare "Edit" beside
                                        // three other links reads identically
                                        // in a screen reader's control list.
                                        aria-label="Edit publish date"
                                        onClick={() => {
                                            dateFocusRef.current = 'input';
                                            setDateEditing(true);
                                        }}
                                        className="inline-flex items-center rounded-md text-xs font-semibold text-primary max-lg:min-h-11 hover:underline focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                                    >
                                        Edit
                                    </button>
                                </div>
                            </>
                        )}
                        {publishedAtError && (
                            <span id={dateErrorId} role="alert" className="text-xs text-error">
                                {publishedAtError}
                            </span>
                        )}
                    </div>

                    {showAuthor && (
                        <div className="flex flex-col gap-1.5 text-sm">
                            <span className="font-semibold text-base-content/85">Author</span>
                            <div className="flex h-9 items-center rounded-md border border-base-300/60 bg-base-200/40 px-3 text-sm text-base-content/70">
                                {author ?? '—'}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-2 border-t border-base-300/60 pt-4">
                        <button
                            type="button"
                            onClick={onDelete}
                            className="inline-flex items-center rounded-md text-xs font-semibold text-error max-lg:min-h-11 hover:underline focus-visible:ring-2 focus-visible:ring-error/50 focus-visible:outline-none"
                        >
                            Move to Trash
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-content shadow-sm max-lg:min-h-11 hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            {primaryLabel}
                        </button>
                    </div>

                    <span role="status" className="sr-only">
                        {announcement}
                    </span>
                </div>
            </EditorPanelChromeProvider>
        </section>
    );
}

/**
 * Convert an ISO 8601 string to the `YYYY-MM-DDTHH:MM` shape
 * `<input type="datetime-local">` expects. Native datetime-locals
 * carry no timezone; we render the wall-clock time in the viewer's
 * local zone so the picker feels natural. Server-side normalization
 * back to app timezone happens at save via `Carbon::parse()`.
 */
function toDateTimeLocal(iso: string | null): string {
    if (null === iso || '' === iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

/** Inverse of {@link toDateTimeLocal}: back to ISO 8601 (UTC). */
function fromDateTimeLocal(value: string): string | null {
    if ('' === value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function formatDisplay(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function actualStatusText(value: ActualStatus, statuses: StatusOption[]): string {
    return statuses.find((s) => s.value === value)?.label ?? value;
}

/**
 * Pill styling for the read-only "what this record actually is" chip.
 *
 * The status colour is carried by the tint and the ring, never by the
 * label text (#193). Coloured text on its own 15%-opacity tint measured
 * 3.5–4.2:1 against the card in light mode — under the 4.5:1 WCAG 1.4.3
 * floor at this 10px size — while `base-content` clears it comfortably in
 * both themes and leaves the hue as the redundant cue it should be.
 */
function actualStatusPillClass(value: ActualStatus): string {
    const base =
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-base-content ring-1 ring-inset';
    switch (value) {
        case 'published':
            return `${base} bg-success/20 ring-success/50`;
        case 'scheduled':
            return `${base} bg-warning/20 ring-warning/50`;
        case 'private':
            return `${base} bg-info/20 ring-info/50`;
        default:
            return `${base} bg-base-300/60 ring-base-300`;
    }
}
